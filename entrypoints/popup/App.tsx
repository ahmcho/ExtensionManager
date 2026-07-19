import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExtensionRow } from '@/components/ExtensionRow';
import { Toggle } from '@/components/Toggle';
import { computeDesiredState } from '@/lib/diff';
import { getSiteKeys, resolveRule, ruleTargetFor, type SiteKeys } from '@/lib/domain';
import { applyDiff, listManageableExtensions, type ApplyResult } from '@/lib/management';
import { alwaysOnItem, deleteRule, rulesItem, setAlwaysOn, upsertRule } from '@/lib/storage';
import type { DomainRule, ManagedExtension } from '@/lib/types';
import { SiteHeader } from './components/SiteHeader';
import { StatusBanner } from './components/StatusBanner';

type Status = 'loading' | 'unmanaged' | 'ready';

export default function App() {
  const [status, setStatus] = useState<Status>('loading');
  const [site, setSite] = useState<SiteKeys | null>(null);
  const [granularity, setGranularity] = useState<'hostname' | 'registrable'>('registrable');
  const [rule, setRule] = useState<DomainRule | undefined>(undefined);
  const [extensions, setExtensions] = useState<ManagedExtension[]>([]);
  const [alwaysOnIds, setAlwaysOnIds] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [applying, setApplying] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);
  const [failures, setFailures] = useState<ApplyResult['failed']>([]);

  const runApply = useCallback(async (currentRule: DomainRule | undefined, currentAlwaysOn: string[], currentExtensions: ManagedExtension[]) => {
    const diff = computeDesiredState(currentExtensions, currentRule, currentAlwaysOn);
    if (diff.length === 0) {
      setAppliedCount(0);
      setFailures([]);
      return currentExtensions;
    }

    setApplying(true);
    const result = await applyDiff(diff);
    setApplying(false);
    setAppliedCount(result.applied.length);
    setFailures(result.failed);

    const changed = new Map(result.applied.map((d) => [d.id, d.to]));
    return currentExtensions.map((e) => (changed.has(e.id) ? { ...e, enabled: changed.get(e.id)! } : e));
  }, []);

  // Initial load: this effect runs as a direct consequence of the user clicking
  // the toolbar icon to open this popup, so browser.management.setEnabled calls
  // triggered from here run inside that gesture. See README "Why click-to-sync".
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      const parsedSite = tab?.url ? getSiteKeys(tab.url) : null;
      if (!parsedSite) {
        if (!cancelled) setStatus('unmanaged');
        return;
      }

      const [rules, alwaysOn, exts] = await Promise.all([
        rulesItem.getValue(),
        alwaysOnItem.getValue(),
        listManageableExtensions(),
      ]);
      if (cancelled) return;

      const resolvedRule = resolveRule(rules, parsedSite);
      const finalExtensions = await runApply(resolvedRule, alwaysOn, exts);
      if (cancelled) return;

      setSite(parsedSite);
      setGranularity(resolvedRule ? (resolvedRule.exact ? 'hostname' : 'registrable') : 'registrable');
      setRule(resolvedRule);
      setAlwaysOnIds(alwaysOn);
      setExtensions(finalExtensions);
      setStatus('ready');
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetry = useCallback(() => {
    runApply(rule, alwaysOnIds, extensions).then(setExtensions);
  }, [rule, alwaysOnIds, extensions, runApply]);

  const persistToggle = useCallback(
    async (ext: ManagedExtension, nextEnabled: boolean) => {
      if (!site) return;
      const target = ruleTargetFor(site, granularity);
      const base: DomainRule =
        rule && rule.key === target.key && rule.exact === target.exact
          ? rule
          : { key: target.key, exact: target.exact, extensionIds: extensions.filter((e) => e.enabled).map((e) => e.id), updatedAt: 0 };

      const ids = new Set(base.extensionIds);
      if (nextEnabled) ids.add(ext.id);
      else ids.delete(ext.id);
      const nextRule: DomainRule = { key: target.key, exact: target.exact, extensionIds: [...ids], updatedAt: Date.now() };
      await upsertRule(nextRule);
      setRule(nextRule);
    },
    [site, granularity, rule, extensions],
  );

  const handleToggle = useCallback(
    async (ext: ManagedExtension, nextEnabled: boolean) => {
      const previous = ext.enabled;
      setExtensions((prev) => prev.map((e) => (e.id === ext.id ? { ...e, enabled: nextEnabled } : e)));
      setFailures([]);

      const result = await applyDiff([{ id: ext.id, name: ext.name, from: previous, to: nextEnabled }]);
      if (result.failed.length > 0) {
        setExtensions((prev) => prev.map((e) => (e.id === ext.id ? { ...e, enabled: previous } : e)));
        setFailures(result.failed);
        return;
      }

      await persistToggle(ext, nextEnabled);
    },
    [persistToggle],
  );

  const handlePin = useCallback(
    async (ext: ManagedExtension, pin: boolean) => {
      await setAlwaysOn(ext.id, pin);
      const nextAlwaysOn = pin ? [...alwaysOnIds, ext.id] : alwaysOnIds.filter((id) => id !== ext.id);
      setAlwaysOnIds(nextAlwaysOn);
      const updated = await runApply(rule, nextAlwaysOn, extensions);
      setExtensions(updated);
    },
    [alwaysOnIds, rule, extensions, runApply],
  );

  const handleGranularityChange = useCallback(
    (g: 'hostname' | 'registrable') => {
      if (!site) return;
      setGranularity(g);
      const target = ruleTargetFor(site, g);
      const existing = rule && rule.key === target.key && rule.exact === target.exact ? rule : undefined;
      setRule(existing);
    },
    [site, rule],
  );

  const handleClearRule = useCallback(async () => {
    if (!rule) return;
    await deleteRule(rule.key);
    setRule(undefined);
    setFailures([]);
    setAppliedCount(0);
  }, [rule]);

  const filtered = useMemo(() => {
    if (!query.trim()) return extensions;
    const q = query.toLowerCase();
    return extensions.filter((e) => e.name.toLowerCase().includes(q));
  }, [extensions, query]);

  const openOptions = useCallback(() => {
    browser.runtime.openOptionsPage();
  }, []);

  return (
    <div className="flex w-96 flex-col bg-zinc-900 text-zinc-100">
      <header className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <h1 className="text-sm font-semibold">Extension Manager</h1>
        <button type="button" onClick={openOptions} className="text-xs text-zinc-400 hover:text-zinc-200">
          Manage all sites →
        </button>
      </header>

      {status === 'loading' && <div className="px-3 py-6 text-center text-sm text-zinc-500">Loading…</div>}

      {status === 'unmanaged' && (
        <div className="px-3 py-6 text-center text-sm text-zinc-500">
          This page can't be managed (browser/internal pages don't support per-site extension rules).
        </div>
      )}

      {status === 'ready' && site && (
        <>
          <SiteHeader
            site={site}
            granularity={granularity}
            onGranularityChange={handleGranularityChange}
            hasRule={!!rule}
            onClearRule={handleClearRule}
          />
          <StatusBanner applying={applying} appliedCount={appliedCount} failures={failures} onRetry={handleRetry} />

          {!rule && (
            <p className="border-b border-zinc-800 px-3 py-2 text-xs text-zinc-500">
              No rule yet for this site — extensions are left as-is. Toggle one below to start one.
            </p>
          )}

          {extensions.length > 6 && (
            <div className="border-b border-zinc-800 px-3 py-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter extensions…"
                className="w-full rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-indigo-400"
              />
            </div>
          )}

          <div className="max-h-96 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-zinc-500">
                {extensions.length === 0 ? 'No other extensions installed.' : 'No extensions match your filter.'}
              </p>
            )}
            {filtered.map((ext) => {
              const pinned = alwaysOnIds.includes(ext.id);
              return (
                <ExtensionRow
                  key={ext.id}
                  extension={ext}
                  subtitle={pinned ? <span className="text-indigo-400">Always on</span> : undefined}
                  right={
                    <>
                      <button
                        type="button"
                        onClick={() => handlePin(ext, !pinned)}
                        title={pinned ? 'Unpin from always-on' : 'Always keep this extension on'}
                        aria-label={pinned ? `Unpin ${ext.name} from always-on` : `Always keep ${ext.name} on`}
                        className={`text-sm leading-none ${pinned ? 'text-indigo-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                      >
                        ★
                      </button>
                      <Toggle
                        checked={ext.enabled}
                        onChange={(next) => handleToggle(ext, next)}
                        disabled={!ext.mayDisable || pinned}
                        label={`Toggle ${ext.name}`}
                        title={pinned ? 'Pinned always-on — unpin to control per-site' : undefined}
                      />
                    </>
                  }
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
