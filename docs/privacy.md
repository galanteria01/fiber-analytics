# Privacy

> Cookieless sessions, truncated IPs, build + ingest redaction, and retention pruning — privacy is a default, not a toggle.

## Summary

| Concern               | Approach                                                                        |
| --------------------- | ------------------------------------------------------------------------------- |
| Cross-site identity   | None — identifiers are per-tab, per-day, and never leave the analytics store.   |
| Precise location      | IPs are truncated before hashing (/24 for IPv4, /48 for IPv6).                  |
| Long-term correlation | `session_hash` uses a UTC-day-scoped secret — it cannot be joined across days.  |
| User opt-out          | DNT and GPC signals are honored; a consent gate can additionally block capture. |
| Sensitive properties  | Redacted at both build time and ingest time via a denylist.                     |
| Stale data            | Worker prunes partitions older than `FA_RETENTION_DAYS`.                        |

## Session identity

### Client `session_id`

The SDK (`packages/browser/src/session.ts:SessionManager`) mints a random UUID held in `sessionStorage` (per-tab, never a persistent cookie). It carries:

- A sliding inactivity window of `sessionTimeoutMs` (default 30 minutes) — after the window elapses the id is rotated.
- A monotonic `seq` counter per session for deterministic intra-session ordering.

No PII is stored in `sessionStorage`; the value is just `{ id, seq, lastActivity }`.

### Server `session_hash`

The edge (`apps/dashboard/lib/session.ts:sessionHash`) derives a secondary correlation / bot-check signal:

```
session_hash = sha256(userAgent + "|" + truncatedIP + "|" + dailySecret)
```

- `truncatedIP` — see IP truncation below.
- `dailySecret` — `FA_DAILY_SECRET + ":" + UTC day (YYYY-MM-DD)`; see daily secret rotation.
- `userAgent` — the request's `User-Agent` header as-is.

`session_hash` is never exposed to the client and is stored only as a Parquet column. It lets the dashboard cross-check client-supplied `session_id` for abuse without retaining a long-lived identifier.

## IP truncation

Implemented in `apps/dashboard/lib/session.ts:truncateIp`:

- **IPv4** -> `/24` — the last octet is replaced with `0` (e.g. `203.0.113.42` -> `203.0.113.0`). Retains network-level grouping for session stitching but removes host-level precision.
- **IPv6** -> `/48` — only the first three hextets are kept (e.g. `2001:db8:85a3:…` -> `2001:db8:85a3::`). This is the typical site-allocation boundary.
- Unknown formats are returned unchanged and then hashed (the hash still rotates daily).

The raw IP is never persisted — only the truncated form contributes to `session_hash`, and the edge is serverless-safe (no disk).

## Daily secret rotation

`FA_DAILY_SECRET` is combined with the current UTC day stamp (`YYYY-MM-DD`) before hashing:

```
dailySecret = FA_DAILY_SECRET + ":" + utcDayStamp(now)
```

Because the secret changes every UTC day, `session_hash` values for the same user cannot be correlated across days — even an adversary with access to the Parquet store cannot join sessions from different days without also knowing the prior day's secret. See `apps/dashboard/lib/session.ts:utcDayStamp` and `sessionHash`.

For production, set `FA_DAILY_SECRET` to a strong random value and rotate it on deploy. If the secret is compromised, past cross-day correlation remains impossible once the day rolls over.

## DNT and GPC

The browser SDK (`packages/browser/src/consent.ts`) checks two browser signals when `respectDnt` is enabled (default `true`):

- **Global Privacy Control** — `navigator.globalPrivacyControl === true`.
- **Do-Not-Track** — `navigator.doNotTrack` (or `window.doNotTrack` / `navigator.msDoNotTrack`) equal to `"1"` or `"yes"`.

If either signal is present, `ConsentManager` forces `granted = false` regardless of the configured `consent` default. Capture is dropped at the `emit` level — nothing is buffered. The user can still re-grant consent explicitly via `setConsent(true)` at runtime, which overrides the signal for that page session.

## Redaction

Redaction happens at two layers so a missed check in one does not leak through the other.

### Build-time (Vite plugin)

`packages/vite-plugin/src/transform.ts:collectProps` drops any static prop whose name:

- Matches `SENSITIVE_PROP_PATTERNS` via `isSensitiveKey` (case-insensitive substring) — patterns include `password`, `passwd`, `secret`, `token`, `apikey`/`api_key`, `auth`, `ssn`, `creditcard`/`credit_card`, `cardnumber`/`card_number`, `cvv`, `email`, `phone` (see `packages/core/src/constants.ts`).
- Matches the user-supplied `propDenylist` option (also case-insensitive).
- Is a handler (`on*`).

Only static primitives (`string`, `number`, `boolean`, `null`) are captured to begin with — objects, arrays, and dynamic expressions are ignored.

### Ingest-time (validation)

`packages/core/src/validate.ts:sanitizeEvent` and `packages/core/src/safelist.ts:safelistProps` apply the same `isSensitiveKey` denylist to the incoming JSON payload: even if a client bypasses the compiler (e.g. a custom `fetch`), sensitive keys are stripped and non-primitive values are dropped, timestamps are clamped (`clampTimestamp`), and string lengths are capped at 2048 chars.

## Retention and pruning

- `FA_RETENTION_DAYS` (default `90`, in both `apps/dashboard/lib/config.ts` and `apps/worker/src/config.ts`) controls how long analytics partitions are kept.
- `apps/worker/src/pipeline.ts:prune` lists `analytics/domain=*/year=*/month=*/day=*` partitions and deletes those whose `year/month/day` is older than the cutoff date. The check is per-partition, not per-row.
- Dashboard filters (date range) do not affect pruning — only the worker deletes data, and only based on the partition date.

## What FiberAnalytics does not do

- No cookies, no `localStorage` identity (besides the ephemeral per-tab `sessionStorage` and an optional `localStorage` spill buffer for failed batches).
- No fingerprinting, no user de-anonymization.
- No third-party scripts.
- No user identity profile or cross-device linking.

See also [Production checklist](production-checklist.md) for the retention and secret settings to audit before going live.
