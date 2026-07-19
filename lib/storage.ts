import { storage } from '#imports';
import type { DomainRule } from './types';

/**
 * Domain rules, keyed by DomainRule.key (hostname or registrable domain).
 * A Record (not an array) so lookups from background/popup are O(1) — this
 * runs on every tab activation/navigation, so it should stay cheap.
 */
export const rulesItem = storage.defineItem<Record<string, DomainRule>>('local:rules', {
  fallback: {},
  version: 1,
});

/** Extension ids pinned to "always on", regardless of which rule applies. */
export const alwaysOnItem = storage.defineItem<string[]>('local:alwaysOnIds', {
  fallback: [],
  version: 1,
});

export async function upsertRule(rule: DomainRule): Promise<void> {
  const rules = await rulesItem.getValue();
  await rulesItem.setValue({ ...rules, [rule.key]: rule });
}

export async function deleteRule(key: string): Promise<void> {
  const rules = await rulesItem.getValue();
  if (!(key in rules)) return;
  const next = { ...rules };
  delete next[key];
  await rulesItem.setValue(next);
}

export async function setAlwaysOn(id: string, alwaysOn: boolean): Promise<void> {
  const ids = await alwaysOnItem.getValue();
  const set = new Set(ids);
  if (alwaysOn) set.add(id);
  else set.delete(id);
  await alwaysOnItem.setValue([...set]);
}

/** Full export shape for the options page's backup/restore feature. */
export interface ExportedState {
  exportedAt: string;
  rules: Record<string, DomainRule>;
  alwaysOnIds: string[];
}

export async function exportState(): Promise<ExportedState> {
  const [rules, alwaysOnIds] = await Promise.all([rulesItem.getValue(), alwaysOnItem.getValue()]);
  return { exportedAt: new Date().toISOString(), rules, alwaysOnIds };
}

export async function importState(data: ExportedState): Promise<void> {
  await Promise.all([rulesItem.setValue(data.rules ?? {}), alwaysOnItem.setValue(data.alwaysOnIds ?? [])]);
}
