/**
 * Shared types for the extension-manager. This is the contract between
 * background, popup, and options entrypoints — all storage reads/writes
 * and message payloads should be typed through this file.
 */

/** A manageable extension, trimmed down from browser.management.ExtensionInfo. */
export interface ManagedExtension {
  id: string;
  name: string;
  shortName: string;
  description: string;
  version: string;
  enabled: boolean;
  /** False when an enterprise/OS policy forbids the user from toggling this extension. */
  mayDisable: boolean;
  /** Best-available icon URL, if the extension declared one. */
  iconUrl?: string;
}

/**
 * A rule binds a site key (hostname or registrable domain, see lib/domain.ts)
 * to the whitelist of extension ids that should be enabled when that site
 * is active. Extensions not listed here are disabled when the rule applies,
 * UNLESS they're in the always-on set.
 */
export interface DomainRule {
  /** Hostname ("mail.google.com") or registrable domain ("google.com"). */
  key: string;
  /** True if `key` is an exact hostname match; false if it's a registrable-domain match. */
  exact: boolean;
  extensionIds: string[];
  updatedAt: number;
}

/** One entry in the diff between "current enabled state" and "desired state for this site". */
export interface DiffEntry {
  id: string;
  name: string;
  from: boolean;
  to: boolean;
}
