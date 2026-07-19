# Extension Manager

A Chromium extension (Manifest V3) for enabling/disabling your *other*
installed extensions on a per-site basis. Configure a whitelist for a domain
("only uBlock Origin and Bitwarden on my banking site") and the tool keeps
everything else off there.

Works on any Chromium-based browser (Chrome, Edge, Brave, Opera, Arc, ...) —
it only uses standard `chrome.*`/`browser.*` WebExtension APIs, no
Chrome-only surface beyond the manifest itself.

## Why click-to-sync, not fully automatic

The obvious design is "switch tabs, extensions silently flip to match." That
design does not work on this platform, and it's worth understanding why
before touching this code:

`browser.management.setEnabled()` — the only API that can enable/disable
another extension — **must be called in the context of a user gesture** (a
click handler), per [Chrome's docs](https://developer.chrome.com/docs/extensions/reference/api/management#method-setEnabled)
and [MDN](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/management/setEnabled).
A background service worker reacting to `tabs.onActivated` or
`webNavigation` events has no such gesture — Chrome rejects the call.

This isn't a theoretical edge case: [Extensity](https://github.com/sergiokas/Extensity),
the best-known "toggle extension groups" tool, only ever flips extensions
from an explicit click inside its own popup, never automatically on
navigation. An older extension that tried true automatic per-site switching
is defunct. Chrome is separately prototyping a *native* per-site toggle in
its own browser UI — as of writing, unstable and Beta-only, with no public
API — which is telling: even Google isn't routing this through the existing
extension platform APIs.

**The model this extension uses instead:** the background service worker
watches tab navigation and computes a diff (what *would* change for the
active tab's site) purely for display — it sets a badge count, nothing else.
Clicking the toolbar icon opens the popup, and that click **is** the user
gesture: the popup applies the diff the instant it mounts. So the badge
tells you when a site needs a sync, and one click (opening the popup) does
the sync. Sites you've already synced show no badge and need no click.

See `lib/management.ts` (`applyDiff`) and `entrypoints/background.ts` for
where this boundary is enforced in code: **only the popup and options page
call `setEnabled`; the background service worker never does.**

## Product decisions worth knowing

These were deliberate calls, not defaults — see git history / conversation
for the reasoning:

- **Conflict model:** "active tab wins." Since `setEnabled` is global (not
  per-tab), the extension set reflects whichever tab you last synced, not a
  per-tab virtual state. Background tabs can be running with the "wrong"
  (previous tab's) extension set until you refocus and resync them.
- **Unconfigured sites are a no-op.** Visiting a domain with no rule leaves
  your extensions exactly as they are — it never disables things by
  surprise. You opt individual sites into whitelist control.
- **Always-on pins.** An extension pinned "always on" (options page or the
  ★ button) stays enabled regardless of what any site's rule says, so a
  whitelist for one site can't accidentally kill your password manager.
- **Policy-locked extensions are always skipped.** If `mayDisable` is
  `false` (enterprise/OS policy), the extension is shown as locked and never
  included in any diff — attempting to toggle it would just throw.
- **Rule granularity is per-hostname or per-registrable-domain**, your
  choice per rule (e.g. a rule can target exactly `mail.google.com`, or all
  of `google.com`). Registrable-domain resolution uses the public suffix
  list (`tldts`, with `allowPrivateDomains` on) so things like
  `alice.github.io` and `bob.github.io` are correctly treated as unrelated
  sites, not lumped under `github.io`.

## Architecture

```
lib/
  types.ts       Shared contracts: DomainRule, ManagedExtension, DiffEntry
  domain.ts       URL -> site keys, rule resolution/targeting (pure, tested)
  diff.ts         computeDesiredState: pure diff between "now" and "should be" (tested)
  management.ts   browser.management wrapper: list extensions, apply a diff
  storage.ts      Typed chrome.storage.local wrapper (via WXT's storage.defineItem)

entrypoints/
  background.ts   Badge-only. Never calls setEnabled.
  popup/          Click-to-sync UI for the current tab's site
  options/        Full rule manager: all extensions, all rules, backup/restore

components/       Small shared UI: Toggle switch, ExtensionRow
```

`lib/diff.ts` and `lib/domain.ts` have zero dependency on `browser.*` and are
unit tested directly. `lib/management.ts` is tested against
[`@webext-core/fake-browser`](https://github.com/webext-core/fake-browser)
with `browser.management` stubbed per-test (fake-browser has no built-in
model for "installed extensions"). `lib/storage.ts` is tested against
fake-browser's real in-memory storage implementation.

## Development

```bash
npm install
npm run dev          # Chrome, with HMR
npm run dev:firefox  # Firefox, with HMR
npm test             # vitest, watch mode
npm run test:run      # vitest, single run
npm run compile       # typecheck
npm run build         # production build -> .output/chrome-mv3
```

To load the built extension: `chrome://extensions` → enable Developer Mode
→ "Load unpacked" → select `.output/chrome-mv3`.

## Permissions

See [PRIVACY.md](./PRIVACY.md) for the full permissions/data-handling
explanation (also shown in-app on the Options page). Short version:
`management` (core feature), `tabs` (read active tab URL only, no page
content), `storage` (local rule storage). No `host_permissions`, no network
requests, no analytics.

## Known limitations

- Enable/disable is **global to the browser**, not per-tab — see "conflict
  model" above. This is a platform limitation, not a bug.
- Toggling an extension causes Chrome to reload it (its background context
  restarts, content scripts re-inject on next navigation). Expect a brief
  flicker/reload of that extension's UI when synced.
- `chrome.storage.local` is used (not `sync`) for a generous quota and no
  dependency on being signed into Chrome; use the Options page's
  Export/Import JSON to move rules between machines.
