import { fakeBrowser } from '@webext-core/fake-browser';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  alwaysOnItem,
  deleteRule,
  exportState,
  importState,
  rulesItem,
  setAlwaysOn,
  upsertRule,
} from '@/lib/storage';
import type { DomainRule } from '@/lib/types';

beforeEach(() => {
  fakeBrowser.reset();
});

const ruleA: DomainRule = { key: 'a.com', exact: false, extensionIds: ['ext-1'], updatedAt: 1 };
const ruleB: DomainRule = { key: 'b.com', exact: false, extensionIds: ['ext-2'], updatedAt: 2 };

describe('rulesItem defaults', () => {
  it('defaults to an empty object', async () => {
    expect(await rulesItem.getValue()).toEqual({});
  });
});

describe('upsertRule / deleteRule', () => {
  it('adds a new rule without disturbing existing ones', async () => {
    await upsertRule(ruleA);
    await upsertRule(ruleB);
    expect(await rulesItem.getValue()).toEqual({ 'a.com': ruleA, 'b.com': ruleB });
  });

  it('overwrites a rule with the same key', async () => {
    await upsertRule(ruleA);
    const updated: DomainRule = { ...ruleA, extensionIds: ['ext-1', 'ext-3'] };
    await upsertRule(updated);
    expect(await rulesItem.getValue()).toEqual({ 'a.com': updated });
  });

  it('deletes a rule by key, leaving others untouched', async () => {
    await upsertRule(ruleA);
    await upsertRule(ruleB);
    await deleteRule('a.com');
    expect(await rulesItem.getValue()).toEqual({ 'b.com': ruleB });
  });

  it('is a no-op when deleting a key that does not exist', async () => {
    await upsertRule(ruleA);
    await deleteRule('nonexistent.com');
    expect(await rulesItem.getValue()).toEqual({ 'a.com': ruleA });
  });
});

describe('setAlwaysOn', () => {
  it('adds an id to the always-on set', async () => {
    await setAlwaysOn('ext-1', true);
    expect(await alwaysOnItem.getValue()).toEqual(['ext-1']);
  });

  it('is idempotent when adding the same id twice', async () => {
    await setAlwaysOn('ext-1', true);
    await setAlwaysOn('ext-1', true);
    expect(await alwaysOnItem.getValue()).toEqual(['ext-1']);
  });

  it('removes an id when set to false', async () => {
    await setAlwaysOn('ext-1', true);
    await setAlwaysOn('ext-2', true);
    await setAlwaysOn('ext-1', false);
    expect(await alwaysOnItem.getValue()).toEqual(['ext-2']);
  });

  it('is a no-op when removing an id that was never pinned', async () => {
    await setAlwaysOn('ext-1', true);
    await setAlwaysOn('ext-99', false);
    expect(await alwaysOnItem.getValue()).toEqual(['ext-1']);
  });
});

describe('exportState / importState', () => {
  it('round-trips rules and always-on ids through export/import', async () => {
    await upsertRule(ruleA);
    await setAlwaysOn('ext-9', true);

    const exported = await exportState();
    expect(exported.rules).toEqual({ 'a.com': ruleA });
    expect(exported.alwaysOnIds).toEqual(['ext-9']);
    expect(typeof exported.exportedAt).toBe('string');

    fakeBrowser.reset();
    expect(await rulesItem.getValue()).toEqual({});

    await importState(exported);
    expect(await rulesItem.getValue()).toEqual({ 'a.com': ruleA });
    expect(await alwaysOnItem.getValue()).toEqual(['ext-9']);
  });

  it('tolerates a partial/malformed import by falling back to empty defaults', async () => {
    await importState({ exportedAt: 'x', rules: undefined as never, alwaysOnIds: undefined as never });
    expect(await rulesItem.getValue()).toEqual({});
    expect(await alwaysOnItem.getValue()).toEqual([]);
  });
});
