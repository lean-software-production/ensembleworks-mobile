import type { Identity, IdentityStoragePort } from '../application/ports';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
const key = 'ensembleworks.mobile.identity.v1';

// Inject AsyncStorage at the entry point; tests exercise the same serialization.
export class PersistentIdentity implements IdentityStoragePort {
  constructor(private readonly storage: KeyValueStorage) {}
  async load(): Promise<Identity | null> {
    const raw = await this.storage.getItem(key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' ||
      !('participantId' in value) || typeof value.participantId !== 'string' || !value.participantId.trim() ||
      !('displayName' in value) || typeof value.displayName !== 'string' || !value.displayName.trim()) {
      throw new Error('Saved identity is invalid.');
    }
    return { participantId: value.participantId, displayName: value.displayName };
  }
  async save(identity: Identity) {
    await this.storage.setItem(key, JSON.stringify(identity));
  }
}
