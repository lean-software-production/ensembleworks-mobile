import { AdapterError, type AuthenticationPort, type Session, type Unsubscribe } from '../application/ports';

export type DeploymentConfiguration = { baseUrl: string; host: string };

// This value is deliberately supplied by build configuration. There is no default
// deployment: a production binary without it cannot accidentally target a room.
export function deploymentConfiguration(value = process.env.EXPO_PUBLIC_DEPLOYMENT_URL): DeploymentConfiguration | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null;
    return { baseUrl: url.origin, host: url.hostname };
  } catch { return null; }
}

// This is intentionally a UI-level result: callers never infer login state from
// HTTP status codes, redirects, or network errors.
export type SignInConfirmation = 'authenticated' | 'awaiting-sign-in' | 'verification-unavailable';
type NativeSessionVerification = 'authenticated' | 'access-redirect' | 'unavailable';

export interface NativeResponse {
  status: number;
  redirected: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

// fetch uses iOS's shared cookie store. react-native-webview's sharedCookiesEnabled
// puts the Access cookie in that store; no cookie value crosses this boundary.
export class NativeCookieTransport {
  async get(url: string): Promise<NativeResponse> {
    return fetch(url, { credentials: 'include', redirect: 'manual' }) as Promise<NativeResponse>;
  }
}

export interface AccessSessionStore {
  load(host: string): Promise<boolean>;
  save(host: string): Promise<void>;
  clear(host: string): Promise<void>;
}
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
// The marker contains only a host, never a cookie, header, credential, or token.
export class PersistentAccessSessionStore implements AccessSessionStore {
  constructor(private readonly storage: KeyValueStore) {}
  private key(host: string) { return `ensembleworks.access-session.${host}`; }
  async load(host: string) { return (await this.storage.getItem(this.key(host))) === 'native-cookie-confirmed'; }
  async save(host: string) { await this.storage.setItem(this.key(host), 'native-cookie-confirmed'); }
  async clear(host: string) { await this.storage.removeItem(this.key(host)); }
}

export class CloudflareAccessAuthentication implements AuthenticationPort {
  private readonly session: Session;
  private readonly listeners = new Set<(session: Session | null) => void>();
  private pending: { promise: Promise<Session>; resolve: (session: Session) => void; reject: (error: Error) => void } | null = null;
  // Native callbacks may overlap. A transition includes the native check, marker
  // mutation, and notification, so an older attempt cannot clean up a newer one.
  private transitionTail: Promise<void> = Promise.resolve();

  constructor(
    readonly deployment: DeploymentConfiguration,
    private readonly transport: Pick<NativeCookieTransport, 'get'>,
    private readonly store: AccessSessionStore,
  ) {
    // This is an opaque local handle only. It is never an Access cookie or token.
    this.session = { kind: 'authenticated', id: `access-session:${deployment.host}` };
  }

  current(): Promise<Session | null> {
    return this.transition(async () => {
      if (!await this.store.load(this.deployment.host)) return null;
      return await this.confirmNativeSession() ? this.session : null;
    });
  }

  signIn(): Promise<Session> {
    if (this.pending) return this.pending.promise;
    let resolve!: (session: Session) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<Session>((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
    this.pending = { promise, resolve, reject };
    return promise;
  }

  // Called after the WebView loads or navigates. A page load alone is not proof of
  // sign-in: only this native request can resolve signIn.
  completeSignIn(): Promise<SignInConfirmation> {
    const attempt = this.pending;
    if (!attempt) return Promise.resolve('verification-unavailable');
    return this.transition(async () => {
      if (this.pending !== attempt) return 'verification-unavailable';
      const result = await this.verifyNativeSession();

      // Cancellation invalidates this callback. Saving and publishing remain in
      // this same transition, rather than racing a later attempt's cleanup.
      if (this.pending !== attempt) return 'verification-unavailable';
      // While the in-app Access flow is pending, an Access redirect means GitHub
      // sign-in is still in progress. `current()` alone expires a persisted session.
      if (result === 'access-redirect') return 'awaiting-sign-in';
      if (result !== 'authenticated') return 'verification-unavailable';

      try {
        await this.store.save(this.deployment.host);
      } catch {
        await this.failAttempt(attempt, 'Unable to save the authenticated session. Please sign in again.');
        return 'verification-unavailable';
      }
      if (this.pending !== attempt) return 'verification-unavailable';
      this.pending = null;
      this.emit(this.session);
      attempt.resolve(this.session);
      return 'authenticated';
    });
  }

  async cancelSignIn(): Promise<void> {
    const attempt = this.pending;
    if (!attempt) return;
    // Invalidate immediately so an in-flight save cannot publish. Its cleanup is
    // queued behind that save and ahead of any newly requested verification.
    this.pending = null;
    attempt.reject(new AdapterError('authentication-required', 'Sign in was cancelled.'));
    void this.transition(async () => {
      try { await this.store.clear(this.deployment.host); } catch { /* cancellation is already settled */ }
      this.emit(null);
    });
  }

  subscribe(listener: (session: Session | null) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async confirmNativeSession(): Promise<boolean> {
    const result = await this.verifyNativeSession();
    if (result === 'access-redirect') {
      await this.expire();
      return false;
    }
    if (result !== 'authenticated') return false;
    try {
      await this.store.save(this.deployment.host);
    } catch {
      throw new AdapterError('authentication-required', 'Unable to save the authenticated session. Please sign in again.');
    }
    this.emit(this.session);
    return true;
  }

  private async verifyNativeSession(): Promise<NativeSessionVerification> {
    try {
      const response = await this.transport.get(this.deployment.baseUrl);
      // The deployment's home page is itself HTML, so HTML is not a login signal
      // here. Redirects are checked manually; token-endpoint login HTML is handled
      // by HttpTokenAdapter before a room can be joined.
      await response.text();
      if (response.redirected || response.status === 401 || response.status === 403 ||
          (response.status >= 300 && response.status < 400)) return 'access-redirect';
      return response.status >= 200 && response.status < 300 ? 'authenticated' : 'unavailable';
    } catch {
      // A network failure is not evidence that an otherwise valid Access session expired.
      return 'unavailable';
    }
  }

  private async expire(attempt?: NonNullable<typeof this.pending>): Promise<boolean> {
    if (attempt && this.pending !== attempt) return false;
    try {
      await this.store.clear(this.deployment.host);
    } catch {
      if (attempt) {
        await this.failAttempt(attempt, 'Unable to clear the expired session. Please sign in again.', false);
        return false;
      }
      throw new AdapterError('authentication-required', 'Unable to clear the expired session. Please sign in again.');
    }
    if (!attempt) { this.emit(null); return false; }
    await this.failAttempt(attempt, 'The authenticated session expired. Please sign in again.', false);
    return false;
  }

  // Keep ownership until clearing has completed. Releasing it first would allow a
  // retry to save a marker that this older cleanup then erases.
  private async failAttempt(attempt: NonNullable<typeof this.pending>, message: string, clear = true) {
    if (this.pending !== attempt) return;
    if (clear) {
      try { await this.store.clear(this.deployment.host); } catch { /* the attempt is still settled below */ }
    }
    if (this.pending !== attempt) return;
    this.pending = null;
    this.emit(null);
    attempt.reject(new AdapterError('authentication-required', message));
  }

  private transition<T>(work: () => Promise<T>): Promise<T> {
    const transition = this.transitionTail.then(work);
    this.transitionTail = transition.then(() => undefined, () => undefined);
    return transition;
  }
  private emit(session: Session | null) { for (const listener of this.listeners) listener(session); }
}
