# Iteration 003 factory validation

Factory validation run on 8 October 2026 from `ensembleworks-mobile/`. No owner credentials were requested, entered, or used. Commands used the parent flox environment directly (not a login shell).

## Environment

- Node: `v24.21.0` (`flox activate -d .. -- node --version`)

## Commands and results

```sh
flox activate -d .. -- npm ci
flox activate -d .. -- npm test
flox activate -d .. -- npm run check
flox activate -d .. -- npx expo-doctor
flox activate -d .. -- node --version
```

All commands passed.

- `npm ci` installed the locked dependencies without force or legacy-peer-deps. npm reported 71 transitive audit findings (25 moderate, 46 high); no dependency changes were made.
- `npm test` passed: 66 application tests and 18 component tests across 7 suites.
- `npm run check` passed TypeScript and Expo dependency compatibility checks.
- `npx expo-doctor` passed all 20 checks.

## Secret-exposure check

Credential-shaped values, secret-bearing authentication headers, and token-bearing URLs were scanned in tracked repository files. The generated simulator application logs under `.build/` and the two PNG files under `docs/evidence/` were also checked for credential-shaped strings. No cookie, token, authenticated header, or token-bearing URL was found. The evidence remains limited to unauthenticated simulator entry points.

This is factory validation only. It does not perform the owner’s real Access sign-in, real-room, or media acceptance checks.
