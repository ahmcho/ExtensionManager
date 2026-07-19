# Privacy Policy — Extension Manager

**No data collection. No network requests. No analytics.**

This extension does not have a server, does not make network requests of any
kind, and does not transmit any data anywhere.

## What it stores, and where

- **Site rules** (which extensions should be enabled per domain/hostname) and
  **always-on pins** are stored using `chrome.storage.local` — an on-device
  storage area private to this browser profile. It is never synced to a
  Google account, never leaves the device, and is not accessible to any
  other extension or website.
- You can inspect or delete this data at any time via the extension's
  Options page ("Export JSON" to view it, or remove the extension to delete
  it entirely).

## What it reads

- **The active tab's URL** (via the `tabs` permission), to determine which
  site rule applies. Only the URL is read — never page content, form data,
  cookies, or anything rendered on the page. No `host_permissions` are
  requested, so this extension cannot inject scripts into or read the
  content of any page.
- **The list of your installed extensions** (via the `management`
  permission) — name, icon, enabled state, and whether policy allows
  toggling it. This is required for the extension's core function (managing
  other extensions) and is never sent anywhere.

## Permissions summary

| Permission | Why |
|---|---|
| `management` | Enable/disable other installed extensions — the core feature. |
| `tabs` | Read the active tab's URL to resolve which site rule applies and show a pending-changes badge. |
| `storage` | Persist your site rules and always-on pins locally. |

No other permissions are requested.
