import { browser } from '#imports';
import type { Browser } from 'wxt/browser';
import type { DiffEntry, ManagedExtension } from './types';

type IconInfo = Browser.management.IconInfo;

function pickIcon(icons: IconInfo[] | undefined): string | undefined {
  if (!icons || icons.length === 0) return undefined;
  // Prefer the smallest icon >= 32px (crisp at popup-list size); fall back to the largest available.
  const sorted = [...icons].sort((a, b) => a.size - b.size);
  return (sorted.find((icon) => icon.size >= 32) ?? sorted[sorted.length - 1]).url;
}

/**
 * Lists installed extensions we're allowed to manage: real extensions only
 * (not themes/apps), excluding this tool itself. Always queried fresh from
 * browser.management.getAll() rather than cached — the list is cheap to
 * fetch and staleness here would mean toggling the wrong state.
 */
export async function listManageableExtensions(): Promise<ManagedExtension[]> {
  const all = await browser.management.getAll();
  const selfId = browser.runtime.id;

  return all
    .filter((item) => item.type === 'extension' && item.id !== selfId)
    .map((item) => ({
      id: item.id,
      name: item.name,
      shortName: item.shortName || item.name,
      description: item.description ?? '',
      version: item.version,
      enabled: item.enabled,
      mayDisable: item.mayDisable,
      iconUrl: pickIcon(item.icons),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface ApplyResult {
  applied: DiffEntry[];
  failed: Array<{ entry: DiffEntry; error: string }>;
}

/**
 * Applies a diff by calling browser.management.setEnabled per entry.
 *
 * IMPORTANT: setEnabled must be called in the context of a user gesture
 * (a click handler), or Chrome rejects it — see README "Why click-to-sync"
 * for the full explanation. This function has no opinion on that; it just
 * performs the calls, so only call it from code that's actually running
 * inside a gesture (the popup's mount effect counts, since opening the
 * popup IS the gesture; a background service worker reacting to tab
 * navigation does NOT).
 *
 * Failures are collected per-entry rather than thrown, so one locked/failed
 * extension doesn't block the rest of the diff from applying.
 */
export async function applyDiff(diff: DiffEntry[]): Promise<ApplyResult> {
  const applied: DiffEntry[] = [];
  const failed: ApplyResult['failed'] = [];

  for (const entry of diff) {
    try {
      await browser.management.setEnabled(entry.id, entry.to);
      applied.push(entry);
    } catch (err) {
      failed.push({ entry, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { applied, failed };
}
