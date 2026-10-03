import { RoomEvent as SDKEvent, type Room } from 'livekit-client';
import type { Participant, RoomEvent, RoomPort } from '../application/ports';

// The native entry point can supply a LiveKit Room and AudioSession. No native
// module is loaded here, so operation/event mappings can run on Linux.
export type LiveKitBoundary = Pick<Room, 'connect' | 'disconnect' | 'localParticipant' | 'remoteParticipants' | 'on' | 'off'>;
export interface AudioSessionBoundary {
  startAudioSession(): Promise<void>;
  stopAudioSession(): Promise<void>;
}
const participantEvents = [SDKEvent.ParticipantConnected, SDKEvent.ParticipantDisconnected,
  SDKEvent.ParticipantNameChanged, SDKEvent.TrackSubscribed, SDKEvent.TrackUnsubscribed,
  SDKEvent.TrackMuted, SDKEvent.TrackUnmuted, SDKEvent.LocalTrackPublished, SDKEvent.LocalTrackUnpublished];

export class LiveKitRoomAdapter implements RoomPort {
  constructor(private sdk: LiveKitBoundary, private audio: AudioSessionBoundary) {}
  async join(input: Parameters<RoomPort['join']>[0]) {
    await this.audio.startAudioSession();
    await this.sdk.connect(input.url, input.token, { autoSubscribe: input.autoSubscribe });
  }
  async setMicrophone(enabled: boolean) { await this.sdk.localParticipant.setMicrophoneEnabled(enabled); }
  async setCamera(enabled: boolean) { await this.sdk.localParticipant.setCameraEnabled(enabled); }
  setRemoteAudioGain(id: string, gain: number) { this.sdk.remoteParticipants.get(id)?.setVolume(gain); }
  subscribe(listener: (event: RoomEvent) => void) {
    const participants = () => {
      // Both local and remote SDK participants expose these common properties.
      const snapshot = (p: Pick<Room['localParticipant'], 'identity' | 'name' | 'isCameraEnabled' | 'isMicrophoneEnabled'>, local: boolean): Participant => ({
        id: p.identity, name: p.name || p.identity, local,
        cameraEnabled: p.isCameraEnabled, microphoneEnabled: p.isMicrophoneEnabled,
      });
      listener({ type: 'participants', participants: [snapshot(this.sdk.localParticipant, true),
        ...Array.from(this.sdk.remoteParticipants.values(), p => snapshot(p, false))] });
    };
    const disconnected = () => listener({ type: 'disconnected', reason: 'The media connection ended.' });
    const error = () => listener({ type: 'error', message: 'Unable to access media devices.' });
    for (const event of participantEvents) this.sdk.on(event, participants);
    this.sdk.on(SDKEvent.Connected, participants);
    this.sdk.on(SDKEvent.Disconnected, disconnected);
    this.sdk.on(SDKEvent.MediaDevicesError, error);
    return () => {
      for (const event of participantEvents) this.sdk.off(event, participants);
      this.sdk.off(SDKEvent.Connected, participants);
      this.sdk.off(SDKEvent.Disconnected, disconnected);
      this.sdk.off(SDKEvent.MediaDevicesError, error);
    };
  }
  async leave() {
    // disconnect(true) releases SDK-owned local tracks. Always stop native audio,
    // even if disconnect rejects; preserve failure for application retry handling.
    try { await this.sdk.disconnect(true); }
    finally { await this.audio.stopAudioSession(); }
  }
}
