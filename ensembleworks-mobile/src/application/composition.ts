import { AdapterError, type ApplicationPorts, type AuthenticationPort } from './ports';
import { createTestAdapters } from '../adapters/testAdapters';

export class UnresolvedAccessAuthentication implements AuthenticationPort {
  async current() { return null; }
  async signIn(): Promise<never> {
    throw new AdapterError('authentication-unresolved', 'Native Cloudflare Access session handoff is unresolved; see the iteration 002 investigation.');
  }
  subscribe() { return () => {}; }
}
export type Composition =
  | { mode: 'demo'; label: 'TEST ADAPTER MODE — no real media or backend'; ports: ApplicationPorts }
  | { mode: 'production'; label: 'Production integration unresolved'; ports: ApplicationPorts | null };
// No fallback: production requires explicitly supplied real adapters once verified.
export function createComposition(mode: 'demo' | 'production', productionPorts?: ApplicationPorts): Composition {
  if (mode === 'demo') return {
    mode, label: 'TEST ADAPTER MODE — no real media or backend', ports: createTestAdapters(),
  };
  return { mode, label: 'Production integration unresolved', ports: productionPorts ?? null };
}
