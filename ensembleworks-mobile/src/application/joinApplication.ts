import { AdapterError, type ApplicationPorts, type Identity, type Participant, type Session, type Unsubscribe } from './ports';

export type JoinState = {
  phase: 'idle' | 'signing-in' | 'needs-name' | 'joining' | 'joined' | 'leaving' | 'failed';
  identity: Identity | null;
  participants?: Participant[];
  microphoneEnabled?: boolean;
  cameraEnabled?: boolean;
  controlsPending?: boolean;
  message?: string;
};

// UI-independent first-launch/relaunch and immediate-join orchestration.
export class JoinApplication {
  private state: JoinState = { phase: 'idle', identity: null };
  private session: Session | null = null;
  private busy = false;
  private roomSubscription: Unsubscribe | null = null;
  private callGeneration = 0;
  private pendingPublication: Promise<void> | null = null;
  private authenticationSubscription: Unsubscribe | null = null;
  private interruption: string | null = null;
  private requiresSignIn = false;
  private listeners = new Set<(state: JoinState) => void>();
  constructor(private readonly ports: ApplicationPorts, private readonly createParticipantId: () => string) {}
  get snapshot(): JoinState {
    return { ...this.state, identity: this.state.identity ? { ...this.state.identity } : null,
      ...(this.state.participants ? { participants: this.state.participants.map(p => ({ ...p })) } : {}) };
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
    if (this.busy || this.state.phase === 'joined' || this.state.phase === 'leaving') return;
    this.busy = true;
    this.interruption = null;
    this.authenticationSubscription ??= this.ports.authentication.subscribe(session => {
      this.session = session;
      if (!session) {
        this.requiresSignIn = true;
        this.interrupt('Your session expired. Sign in again to join.');
      }
    });
    try {
      if (this.cleanupRequired && !await this.cleanupRoom()) return;
      this.update({ phase: 'signing-in', identity: this.state.identity });
      this.session = this.requiresSignIn ? await this.ports.authentication.signIn() :
        await this.ports.authentication.current() ?? await this.ports.authentication.signIn();
      this.requiresSignIn = false;
      const identity = await this.ports.identity.load();
      if (this.interruption) throw new Error(this.interruption);
      this.update({ phase: identity ? 'joining' : 'needs-name', identity });
      if (identity) await this.connect(identity);
    } catch {
      this.update({ phase: 'failed', identity: this.state.identity, message: this.interruption ?? 'Unable to sign in or load your identity. Try again.' });
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
    const generation = ++this.callGeneration;
    const checkActive = () => {
      if (generation !== this.callGeneration || this.interruption) throw new Error('Call interrupted');
    };
    try {
      const permissions = await this.ports.permissions.request();
      checkActive();
      if (permissions.microphone !== 'granted' || permissions.camera !== 'granted') {
        this.update({ phase: 'failed', identity, message: 'Camera and microphone permission are required. Enable them in Settings, then retry.' });
        return;
      }
      if (!this.session) throw new Error('No session');
      const result = await this.ports.tokens.retrieve({
        room: 'team', identity: identity.participantId, name: identity.displayName, session: this.session,
      });
      checkActive();
      if (!result.enabled) {
        this.update({ phase: 'failed', identity, message: 'Room media is unavailable. Try again later or contact the room administrator.' });
        return;
      }
      roomAttempted = true;
      this.roomSubscription = this.ports.room.subscribe(event => {
        if (generation !== this.callGeneration) return;
        if (event.type !== 'participants') {
          this.interrupt(event.type === 'disconnected' ? 'Connection lost. Retry to rejoin the room.' : 'Room connection failed. Retry to rejoin.');
          return;
        }
        const remotes = event.participants.filter(p => !p.local && p.id !== identity.participantId);
        for (const participant of remotes) this.ports.room.setRemoteAudioGain(participant.id, 1);
        const local = this.state.participants?.find(p => p.local);
        this.update({ ...this.state, participants: [...(local ? [local] : []), ...remotes.map(p => ({ ...p }))] });
      });
      await this.ports.room.join({ token: result.token, url: result.url, autoSubscribe: true });
      checkActive();
      await this.ports.room.setMicrophone(true);
      checkActive();
      await this.ports.room.setCamera(true);
      checkActive();
      this.update({ phase: 'joined', identity, microphoneEnabled: true, cameraEnabled: true,
        participants: [{ id: identity.participantId, name: identity.displayName, local: true,
          microphoneEnabled: true, cameraEnabled: true }, ...(this.state.participants ?? []).filter(p => !p.local)] });
    } catch (error) {
      if (error instanceof AdapterError && error.code === 'authentication-required') {
        this.session = null;
        this.requiresSignIn = true;
        this.interruption = 'Your session expired. Sign in again to join.';
      }
      if (roomAttempted && !await this.cleanupRoom(this.interruption ?? undefined)) return;
      this.update({ phase: 'failed', identity, message: this.interruption ?? 'Unable to join the room. Check your connection and retry.' });
    }
  }
  private interrupt(message: string) {
    this.interruption = message;
    this.unsubscribeRoom();
    if (this.state.phase === 'joined') {
      this.busy = true;
      const identity = this.state.identity;
      this.update({ phase: 'leaving', identity });
      void (async () => {
        try {
          if (await this.cleanupRoom(message)) this.update({ phase: 'failed', identity, message });
        } finally { this.busy = false; }
      })();
    } else if (!this.busy && this.state.phase !== 'leaving') {
      this.update({ phase: 'failed', identity: this.state.identity, message });
    }
  }
  private cleanupRequired = false;
  private async cleanupRoom(context?: string): Promise<boolean> {
    this.cleanupRequired = true;
    this.unsubscribeRoom();
    try {
      // Finish in-flight publications so they cannot reactivate media after cleanup.
      await this.pendingPublication?.catch(() => {});
      await this.ports.room.leave();
      this.cleanupRequired = false;
      return true;
    } catch {
      this.update({ phase: 'failed', identity: this.state.identity,
        message: `${context ? `${context} ` : ''}Media cleanup failed. Retry cleanup before rejoining.` });
      return false;
    }
  }
  private unsubscribeRoom() {
    ++this.callGeneration;
    this.roomSubscription?.();
    this.roomSubscription = null;
  }
  async toggleMicrophone() { await this.toggle('microphone'); }
  async toggleCamera() { await this.toggle('camera'); }
  private async toggle(kind: 'microphone' | 'camera') {
    if (this.state.phase !== 'joined' || this.state.controlsPending) return;
    const generation = this.callGeneration;
    const key = kind === 'microphone' ? 'microphoneEnabled' : 'cameraEnabled';
    const enabled = !this.state[key];
    this.update({ ...this.state, controlsPending: true, message: undefined });
    try {
      this.pendingPublication = kind === 'microphone' ? this.ports.room.setMicrophone(enabled) : this.ports.room.setCamera(enabled);
      await this.pendingPublication;
      if (generation !== this.callGeneration) return;
      this.update({ ...this.state, [key]: enabled, controlsPending: false,
        participants: this.state.participants?.map(p => p.local ? { ...p, [key]: enabled } : p) });
    } catch {
      if (generation === this.callGeneration) this.update({ ...this.state, controlsPending: false,
        message: `Unable to change ${kind}. Try again.` });
    } finally { this.pendingPublication = null; }
  }
  async leave() {
    if (this.state.phase !== 'joined') return;
    const identity = this.state.identity;
    this.update({ phase: 'leaving', identity });
    if (await this.cleanupRoom()) this.update({ phase: 'idle', identity });
  }
}
