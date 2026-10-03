import type { ApplicationPorts, Identity, Session, Unsubscribe } from './ports';

export type JoinState = {
  phase: 'idle' | 'signing-in' | 'needs-name' | 'joining' | 'joined' | 'failed';
  identity: Identity | null;
  message?: string;
};

// UI-independent first-launch/relaunch and immediate-join orchestration.
export class JoinApplication {
  private state: JoinState = { phase: 'idle', identity: null };
  private session: Session | null = null;
  private busy = false;
  private listeners = new Set<(state: JoinState) => void>();
  constructor(private readonly ports: ApplicationPorts, private readonly createParticipantId: () => string) {}
  get snapshot(): JoinState {
    return { ...this.state, identity: this.state.identity ? { ...this.state.identity } : null };
  }
  subscribe(listener: (state: JoinState) => void): Unsubscribe {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private update(state: JoinState) {
    this.state = state;
    for (const listener of this.listeners) listener(this.snapshot);
  }
  async start() {
    if (this.busy || this.state.phase === 'joined') return;
    this.busy = true;
    this.update({ phase: 'signing-in', identity: this.state.identity });
    try {
      this.session = await this.ports.authentication.current() ?? await this.ports.authentication.signIn();
      const identity = await this.ports.identity.load();
      this.update({ phase: identity ? 'joining' : 'needs-name', identity });
      if (identity) await this.connect(identity);
    } catch {
      this.update({ phase: 'failed', identity: this.state.identity, message: 'Unable to sign in or load your identity.' });
    } finally { this.busy = false; }
  }
  async submitDisplayName(name: string) {
    if (this.busy || this.state.phase !== 'needs-name') return;
    const displayName = name.trim();
    if (!displayName) {
      this.update({ ...this.state, message: 'Enter a display name.' });
      return;
    }
    this.busy = true;
    try {
      const identity = { participantId: this.createParticipantId(), displayName };
      if (!identity.participantId.trim()) throw new Error('Missing participant ID');
      // Persist before requesting media: denials and relaunches do not change identity.
      await this.ports.identity.save(identity);
      await this.connect(identity);
    } catch {
      this.update({ phase: 'failed', identity: this.state.identity, message: 'Unable to save your identity.' });
    } finally { this.busy = false; }
  }
  private async connect(identity: Identity) {
    this.update({ phase: 'joining', identity });
    let roomAttempted = false;
    try {
      const permissions = await this.ports.permissions.request();
      if (permissions.microphone !== 'granted' || permissions.camera !== 'granted') {
        this.update({ phase: 'failed', identity, message: 'Camera and microphone permission are required.' });
        return;
      }
      if (!this.session) throw new Error('No session');
      const result = await this.ports.tokens.retrieve({
        room: 'team', identity: identity.participantId, name: identity.displayName, session: this.session,
      });
      if (!result.enabled) {
        this.update({ phase: 'failed', identity, message: 'Room media is unavailable.' });
        return;
      }
      roomAttempted = true;
      await this.ports.room.join({ token: result.token, url: result.url, autoSubscribe: true });
      await this.ports.room.setMicrophone(true);
      await this.ports.room.setCamera(true);
      this.update({ phase: 'joined', identity });
    } catch {
      if (roomAttempted) {
        try { await this.ports.room.leave(); } catch { /* Still report failure, never a successful join. */ }
      }
      this.update({ phase: 'failed', identity, message: 'Unable to join the room.' });
    }
  }
}
