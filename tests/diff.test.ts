import { describe, expect, it } from 'vitest';
import { computeDesiredState } from '@/lib/diff';
import type { DomainRule, ManagedExtension } from '@/lib/types';

function ext(overrides: Partial<ManagedExtension> & { id: string }): ManagedExtension {
  return {
    name: overrides.id,
    shortName: overrides.id,
    description: '',
    version: '1.0',
    enabled: true,
    mayDisable: true,
    ...overrides,
  };
}

describe('computeDesiredState', () => {
  it('returns an empty diff when no rule is configured for the site', () => {
    // Product decision: unconfigured domains are a no-op, never surprise-disable.
    const extensions = [ext({ id: 'a', enabled: true }), ext({ id: 'b', enabled: false })];
    expect(computeDesiredState(extensions, undefined, [])).toEqual([]);
  });

  it('disables extensions not on the whitelist', () => {
    const extensions = [ext({ id: 'a', enabled: true }), ext({ id: 'b', enabled: true })];
    const rule: DomainRule = { key: 'site.com', exact: false, extensionIds: ['a'], updatedAt: 0 };
    expect(computeDesiredState(extensions, rule, [])).toEqual([{ id: 'b', name: 'b', from: true, to: false }]);
  });

  it('enables extensions on the whitelist that are currently disabled', () => {
    const extensions = [ext({ id: 'a', enabled: false })];
    const rule: DomainRule = { key: 'site.com', exact: false, extensionIds: ['a'], updatedAt: 0 };
    expect(computeDesiredState(extensions, rule, [])).toEqual([{ id: 'a', name: 'a', from: false, to: true }]);
  });

  it('produces no diff entries for extensions already in their desired state', () => {
    const extensions = [ext({ id: 'a', enabled: true }), ext({ id: 'b', enabled: false })];
    const rule: DomainRule = { key: 'site.com', exact: false, extensionIds: ['a'], updatedAt: 0 };
    expect(computeDesiredState(extensions, rule, [])).toEqual([]);
  });

  it('keeps always-on extensions enabled even when a whitelist rule would disable them', () => {
    const extensions = [ext({ id: 'password-manager', enabled: true })];
    const rule: DomainRule = { key: 'site.com', exact: false, extensionIds: [], updatedAt: 0 };
    expect(computeDesiredState(extensions, rule, ['password-manager'])).toEqual([]);
  });

  it('enables an always-on extension that happens to be off, even if not on the whitelist', () => {
    const extensions = [ext({ id: 'password-manager', enabled: false })];
    const rule: DomainRule = { key: 'site.com', exact: false, extensionIds: [], updatedAt: 0 };
    expect(computeDesiredState(extensions, rule, ['password-manager'])).toEqual([
      { id: 'password-manager', name: 'password-manager', from: false, to: true },
    ]);
  });

  it('never includes policy-locked extensions (mayDisable: false) in the diff', () => {
    const extensions = [ext({ id: 'locked', enabled: true, mayDisable: false })];
    const rule: DomainRule = { key: 'site.com', exact: false, extensionIds: [], updatedAt: 0 };
    // Whitelist says it should be off, but we must never attempt to toggle a
    // policy-locked extension -- the browser call would just throw.
    expect(computeDesiredState(extensions, rule, [])).toEqual([]);
  });

  it('handles a mixed batch: some enable, some disable, some no-op, some locked, some pinned', () => {
    const extensions = [
      ext({ id: 'keep-on', enabled: true }),
      ext({ id: 'turn-on', enabled: false }),
      ext({ id: 'turn-off', enabled: true }),
      ext({ id: 'locked-on', enabled: true, mayDisable: false }),
      ext({ id: 'pinned', enabled: true }),
    ];
    const rule: DomainRule = {
      key: 'site.com',
      exact: false,
      extensionIds: ['keep-on', 'turn-on'],
      updatedAt: 0,
    };
    const diff = computeDesiredState(extensions, rule, ['pinned']);
    expect(diff).toEqual(
      expect.arrayContaining([
        { id: 'turn-off', name: 'turn-off', from: true, to: false },
        { id: 'turn-on', name: 'turn-on', from: false, to: true },
      ]),
    );
    expect(diff).toHaveLength(2);
  });
});
