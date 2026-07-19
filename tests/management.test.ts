import { fakeBrowser } from '@webext-core/fake-browser';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyDiff, listManageableExtensions } from '@/lib/management';
import type { DiffEntry } from '@/lib/types';

// @webext-core/fake-browser doesn't implement browser.management (there's no
// meaningful in-memory model for "installed extensions"), so we stub it
// per-test. WXT's vitest plugin aliases `browser` to this same fakeBrowser
// singleton, so mutating it here is visible to the code under test.
function stubManagement(extensions: unknown[]) {
  (fakeBrowser as unknown as { management: unknown }).management = {
    getAll: vi.fn().mockResolvedValue(extensions),
    setEnabled: vi.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  fakeBrowser.reset();
});

describe('listManageableExtensions', () => {
  it('excludes themes and this extension itself, keeping only real extensions', async () => {
    const selfId = fakeBrowser.runtime.id;
    stubManagement([
      { id: selfId, name: 'Extension Manager', type: 'extension', enabled: true, mayDisable: true },
      { id: 'theme-1', name: 'Some Theme', type: 'theme', enabled: true, mayDisable: true },
      { id: 'ext-1', name: 'uBlock Origin', type: 'extension', enabled: true, mayDisable: true },
    ]);

    const result = await listManageableExtensions();
    expect(result.map((e) => e.id)).toEqual(['ext-1']);
  });

  it('sorts results alphabetically by name', async () => {
    stubManagement([
      { id: 'b', name: 'Zeta', type: 'extension', enabled: true, mayDisable: true },
      { id: 'a', name: 'Alpha', type: 'extension', enabled: true, mayDisable: true },
    ]);
    const result = await listManageableExtensions();
    expect(result.map((e) => e.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('picks the smallest icon >= 32px, or the largest available otherwise', async () => {
    stubManagement([
      {
        id: 'a',
        name: 'A',
        type: 'extension',
        enabled: true,
        mayDisable: true,
        icons: [
          { size: 16, url: 'icon16.png' },
          { size: 48, url: 'icon48.png' },
          { size: 128, url: 'icon128.png' },
        ],
      },
      {
        id: 'b',
        name: 'B',
        type: 'extension',
        enabled: true,
        mayDisable: true,
        icons: [{ size: 16, url: 'icon16.png' }],
      },
    ]);
    const result = await listManageableExtensions();
    expect(result.find((e) => e.id === 'a')?.iconUrl).toBe('icon48.png');
    expect(result.find((e) => e.id === 'b')?.iconUrl).toBe('icon16.png');
  });

  it('falls back to full name when shortName is absent', async () => {
    stubManagement([{ id: 'a', name: 'Full Name', type: 'extension', enabled: true, mayDisable: true }]);
    const result = await listManageableExtensions();
    expect(result[0].shortName).toBe('Full Name');
  });
});

describe('applyDiff', () => {
  it('calls setEnabled for every entry and reports them all as applied on success', async () => {
    stubManagement([]);
    const diff: DiffEntry[] = [
      { id: 'a', name: 'A', from: true, to: false },
      { id: 'b', name: 'B', from: false, to: true },
    ];
    const result = await applyDiff(diff);
    expect(result.applied).toEqual(diff);
    expect(result.failed).toEqual([]);
    expect(fakeBrowser.management.setEnabled).toHaveBeenCalledWith('a', false);
    expect(fakeBrowser.management.setEnabled).toHaveBeenCalledWith('b', true);
  });

  it('collects a per-entry failure without aborting the rest of the diff', async () => {
    stubManagement([]);
    (fakeBrowser.management.setEnabled as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error('This function must be called during a user gesture.'))
      .mockResolvedValueOnce(undefined);

    const diff: DiffEntry[] = [
      { id: 'locked', name: 'Locked', from: true, to: false },
      { id: 'ok', name: 'Ok', from: false, to: true },
    ];
    const result = await applyDiff(diff);

    expect(result.applied).toEqual([diff[1]]);
    expect(result.failed).toEqual([{ entry: diff[0], error: 'This function must be called during a user gesture.' }]);
  });

  it('returns empty results for an empty diff without calling setEnabled', async () => {
    stubManagement([]);
    const result = await applyDiff([]);
    expect(result).toEqual({ applied: [], failed: [] });
    expect(fakeBrowser.management.setEnabled).not.toHaveBeenCalled();
  });
});
