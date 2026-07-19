import type { DiffEntry, DomainRule, ManagedExtension } from './types';

/**
 * Computes what should change for a given site, given the currently installed
 * extensions and (optionally) the rule bound to that site.
 *
 * Pure and side-effect free by design — this is the one piece of business
 * logic that decides "what changes", so it's unit tested in isolation from
 * any browser.* API. Callers (popup/background) are responsible for actually
 * applying the diff, in whatever context has the user-gesture privileges to
 * do so.
 *
 * Rules:
 * - No rule for the site => empty diff (explicit product decision: unconfigured
 *   sites are a no-op, never surprise-disable extensions on a site you haven't
 *   set up yet).
 * - An extension pinned "always on" stays enabled regardless of the rule.
 * - Extensions the user isn't allowed to toggle (enterprise/OS policy-locked,
 *   `mayDisable === false`) are never included in the diff — attempting to
 *   toggle them would just throw.
 */
export function computeDesiredState(
  extensions: ManagedExtension[],
  rule: DomainRule | undefined,
  alwaysOnIds: Iterable<string>,
): DiffEntry[] {
  if (!rule) return [];

  const alwaysOn = new Set(alwaysOnIds);
  const whitelist = new Set(rule.extensionIds);
  const diff: DiffEntry[] = [];

  for (const ext of extensions) {
    if (!ext.mayDisable) continue;

    const desired = alwaysOn.has(ext.id) || whitelist.has(ext.id);
    if (desired !== ext.enabled) {
      diff.push({ id: ext.id, name: ext.name, from: ext.enabled, to: desired });
    }
  }

  return diff;
}
