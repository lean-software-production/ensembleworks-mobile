import type { ApplicationPorts, Identity, Participant, Session, Unsubscribe } from './ports';

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
      const generation = ++this.callGeneration;
      this.roomSubscription = this.ports.room.subscribe(event => {
        if (generation !== this.callGeneration || event.type !== 'participants') return;
        const remotes = event.participants.filter(p => !p.local && p.id !== identity.participantId);
        for (const participant of remotes) this.ports.room.setRemoteAudioGain(participant.id, 1);
        const local = this.state.participants?.find(p => p.local);
        this.update({ ...this.state, participants: [...(local ? [local] : []), ...remotes.map(p => ({ ...p }))] });
      });
      await this.ports.room.join({ token: result.token, url: result.url, autoSubscribe: true });
      await this.ports.room.setMicrophone(true);
      await this.ports.room.setCamera(true);
      this.update({ phase: 'joined', identity, microphoneEnabled: true, cameraEnabled: true,
        participants: [{ id: identity.participantId, name: identity.displayName, local: true,
          microphoneEnabled: true, cameraEnabled: true }, ...(this.state.participants ?? []).filter(p => !p.local)] });
    } catch {
      if (roomAttempted) {
        this.unsubscribeRoom();
        try { await this.ports.room.leave(); } catch { /* Still report failure, never a successful join. */ }
      }
      this.update({ phase: 'failed', identity, message: 'Unable to join the room.' });
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
    this.unsubscribeRoom();
    const identity = this.state.identity;
    this.update({ phase: 'leaving', identity });
    try {
      // Finish any in-flight publication before final cleanup, so it cannot
      // reactivate native media after disconnecting.
      await this.pendingPublication?.catch(() => {});
      await this.ports.room.leave();
      this.update({ phase: 'idle', identity });
    } catch {
      this.update({ phase: 'failed', identity, message: 'Unable to leave the room cleanly.' });
    }
  }
}
