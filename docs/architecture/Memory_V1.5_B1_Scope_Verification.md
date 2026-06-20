# V1.5 Blocker B1 — OAuth Scope Verification

**Question:** Is the owner-alias signal (`sendAs.list`) blocked by a missing OAuth scope?
**Method:** Inspected Uyra's actual OAuth configuration in code; verified the required scope against Google's official Gmail API reference.
**Result: B1 is NOT a blocker. Proceed with V1.5 unchanged.**

---

## What the codebase actually configures

| Location | Scope string requested |
|---|---|
| `lib/auth.ts` (base sign-in) | `openid email profile` |
| `components/ConnectGmailButton.tsx` (Gmail connect / incremental auth) | `openid email profile https://www.googleapis.com/auth/gmail.readonly` |
| `lib/auth.ts` `GMAIL_SCOPE` (status check) | `https://www.googleapis.com/auth/gmail.readonly` |

**The only Gmail scope Uyra requests or holds is `gmail.readonly`.** There is no `gmail.settings.basic` and no `gmail.modify` anywhere in the codebase.

## What `sendAs.list` actually requires

From Google's official reference for `users.settings.sendAs.list` (developers.google.com/gmail/api/reference/rest/v1/users.settings.sendAs/list), **Authorization scopes — "Requires one of the following OAuth scopes":**

- `https://www.googleapis.com/auth/gmail.settings.basic`
- `https://mail.google.com/`
- `https://www.googleapis.com/auth/gmail.modify`
- **`https://www.googleapis.com/auth/gmail.readonly`** ✅

`sendAs.list` is a **read** operation, and `gmail.readonly` is explicitly an accepted scope for it. `gmail.settings.basic` is only needed for *write* operations on settings (create/update/delete/patch send-as aliases) — which V1.5 does not perform.

**My earlier B1 claim — that `sendAs.list` needs `gmail.settings.basic` — was incorrect.** The read/list call is covered by the `gmail.readonly` scope Uyra already has.

---

## Answers to the four questions

**1. Is `gmail.settings.basic` already available?**
No — it is not configured. But it is **not required** for V1.5.

**2. Can `sendAs.list` be called with the current OAuth configuration?**
**Yes.** Existing connected users' tokens already carry `gmail.readonly`, which authorizes `users.settings.sendAs.list`. The call works with the tokens you hold today — no new grant, no re-auth, no token changes.

**3. Consent-screen / production-user impact if the scope must be added?**
**None — because no scope needs to be added.** V1.5 adds an API *call* that uses an already-granted, already-declared scope. There is no new consent prompt, no forced reconnect for existing users, and no Google re-verification. (For completeness: *had* a new restricted scope been required, it would have triggered re-consent for every user and possibly a Google security re-review — but that situation does not arise here.)

**4. Is owner alias handling truly blocked, or only degraded?**
**Neither.** It is **fully available** on the current scope. Authoritative owner-identity-set resolution via `sendAs.list` can ship in V1.5 as the primary path — the single-address fallback described in the prior design is now a defensive nicety (for the rare case the API call fails at runtime), not a required operating mode.

---

## Recommendation

**Proceed with V1.5 unchanged.** B1 dissolves on verification:

- No scope addition is needed; `gmail.readonly` already authorizes `sendAs.list`.
- Owner-alias handling moves from "degraded fallback" to **authoritative primary path** with zero consent/verification/user-reconnect cost.
- Keep the single-address fallback only as a runtime safety net (handle a failed/empty `sendAs.list` gracefully, flag reduced confidence) — not as the expected mode.

One small operational note: confirm at runtime that the access token presented to `sendAs.list` is the `gmail.readonly`-scoped token (it is the same token already used for `threads.list`/`threads.get`), so no separate token plumbing is required.

**This memo supersedes the B1 entry and the "one prerequisite" caveat in `Memory_V1.5_Implementation_Architecture.md`.** With B1 cleared, that design is implementation-ready with no outstanding blockers.
