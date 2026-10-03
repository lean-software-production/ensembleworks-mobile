import { AdapterError, type TokenPort, type TokenRequest, type TokenResult } from '../application/ports';

export interface HttpResponse {
  status: number;
  redirected: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}
// The production transport must bind a supported Access session to the request.
// Session.id is only an opaque local handle: it is not a bearer token or cookie.
export interface AuthenticatedTransport {
  get(url: string, session: TokenRequest['session']): Promise<HttpResponse>;
}
export class HttpTokenAdapter implements TokenPort {
  private readonly endpoint: URL;
  constructor(baseUrl: string, private readonly transport: AuthenticatedTransport) {
    this.endpoint = new URL('/api/av/token', baseUrl);
    if (this.endpoint.protocol !== 'https:') throw new Error('Token endpoint must use HTTPS');
  }
  async retrieve(request: TokenRequest): Promise<TokenResult> {
    if (request.session.kind !== 'authenticated') {
      throw new AdapterError('authentication-required', 'Demo sessions cannot access the backend.');
    }
    const url = new URL(this.endpoint);
    url.search = new URLSearchParams({ room: request.room, identity: request.identity, name: request.name }).toString();
    let response: HttpResponse;
    let body: string;
    try {
      response = await this.transport.get(url.toString(), request.session);
      // Redirects are not a token response, even if Access ultimately returns HTTP 200.
      if (response.redirected || response.status === 401 || response.status === 403 ||
          (response.status >= 300 && response.status < 400)) {
        throw new AdapterError('authentication-required', 'Sign in again to access the room.');
      }
      body = await response.text();
    } catch (error) {
      if (error instanceof AdapterError) throw error;
      throw new AdapterError('network', 'Unable to reach the token service. Retry when connected.');
    }
    if (/text\/html/i.test(response.headers.get('content-type') ?? '') || /^\s*</.test(body)) {
      throw new AdapterError('authentication-required', 'The token service returned a login page. Sign in again.');
    }
    if (response.status < 200 || response.status >= 300) {
      throw new AdapterError('network', 'The token service is unavailable. Please retry.');
    }
    let data: unknown;
    try { data = JSON.parse(body); } catch {
      throw new AdapterError('invalid-response', 'The token service returned invalid JSON.');
    }
    if (typeof data !== 'object' || data === null) return invalid();
    const value = data as Record<string, unknown>;
    if (value.enabled === false) return { enabled: false };
    if (value.enabled !== true || typeof value.token !== 'string' || !value.token.trim() ||
        typeof value.url !== 'string') return invalid();
    try {
      const signaling = new URL(value.url);
      if (signaling.protocol !== 'wss:' || !signaling.hostname || signaling.username || signaling.password) return invalid();
    } catch { return invalid(); }
    return { enabled: true, token: value.token, url: value.url };
  }
}
function invalid(): never {
  throw new AdapterError('invalid-response', 'The token service returned an invalid media contract.');
}
