import { useCallback, useEffect, useState } from 'react';
import { ExtensionRow } from '@/components/ExtensionRow';
import { Toggle } from '@/components/Toggle';
import { applyDiff, listManageableExtensions } from '@/lib/management';
import { alwaysOnItem, deleteRule, rulesItem, setAlwaysOn, upsertRule } from '@/lib/storage';
import type { DomainRule, ManagedExtension } from '@/lib/types';
import { BackupSection } from './components/BackupSection';
import { RuleEditor } from './components/RuleEditor';

export default function App() {
  const [extensions, setExtensions] = useState<ManagedExtension[]>([]);
  const [alwaysOnIds, setAlwaysOnIds] = useState<string[]>([]);
  const [rules, setRules] = useState<Record<string, DomainRule>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<'new' | string | null>(null);

  const refresh = useCallback(async () => {
    const [exts, alwaysOn, storedRules] = await Promise.all([
      listManageableExtensions(),
      alwaysOnItem.getValue(),
      rulesItem.getValue(),
    ]);
    setExtensions(exts);
    setAlwaysOnIds(alwaysOn);
    setRules(storedRules);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggleExtension = useCallback(async (ext: ManagedExtension, next: boolean) => {
    setExtensions((prev) => prev.map((e) => (e.id === ext.id ? { ...e, enabled: next } : e)));
    const result = await applyDiff([{ id: ext.id, name: ext.name, from: ext.enabled, to: next }]);
    if (result.failed.length > 0) {
      setExtensions((prev) => prev.map((e) => (e.id === ext.id ? { ...e, enabled: ext.enabled } : e)));
    }
  }, []);

  const handlePin = useCallback(async (ext: ManagedExtension, pin: boolean) => {
    await setAlwaysOn(ext.id, pin);
    setAlwaysOnIds((prev) => (pin ? [...prev, ext.id] : prev.filter((id) => id !== ext.id)));
    if (pin && !ext.enabled) {
      const result = await applyDiff([{ id: ext.id, name: ext.name, from: false, to: true }]);
      if (result.applied.length > 0) {
        setExtensions((prev) => prev.map((e) => (e.id === ext.id ? { ...e, enabled: true } : e)));
      }
    }
  }, []);

  const handleSaveRule = useCallback(async (rule: DomainRule) => {
    await upsertRule(rule);
    setRules((prev) => ({ ...prev, [rule.key]: rule }));
    setEditing(null);
  }, []);

  const handleDeleteRule = useCallback(async (key: string) => {
    if (!confirm(`Remove the rule for "${key}"? Extensions will stay in their current state.`)) return;
    await deleteRule(key);
    setRules((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const ruleList = Object.values(rules).sort((a, b) => a.key.localeCompare(b.key));

  return (
    <div className="mx-auto min-h-screen max-w-2xl bg-zinc-950 px-6 py-8 text-zinc-100">
      <header className="mb-6">
        <h1 className="text-xl font-bold">Extension Manager</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Manage which extensions run on which sites. Rules are whitelists: extensions listed for a site stay enabled, everything
          else is disabled while you're there.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <div className="space-y-6">
          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="mb-1 text-sm font-semibold text-zinc-100">Your extensions</h2>
            <p className="mb-3 text-xs text-zinc-500">
              Toggle an extension on/off globally, or pin it <span className="text-indigo-400">★ always on</span> so no site rule
              can disable it.
            </p>
            <div className="divide-y divide-zinc-800">
              {extensions.map((ext) => {
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
                          onChange={(next) => handleToggleExtension(ext, next)}
                          disabled={!ext.mayDisable}
                          label={`Toggle ${ext.name}`}
                        />
                      </>
                    }
                  />
                );
              })}
              {extensions.length === 0 && <p className="py-3 text-sm text-zinc-500">No manageable extensions installed.</p>}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Site rules</h2>
                <p className="text-xs text-zinc-500">Sites without a rule are left untouched.</p>
              </div>
              {editing === null && (
                <button
                  type="button"
                  onClick={() => setEditing('new')}
                  className="rounded bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
                >
                  + Add rule
                </button>
              )}
            </div>

            {editing === 'new' && (
              <div className="mb-4">
                <RuleEditor extensions={extensions} onSave={handleSaveRule} onCancel={() => setEditing(null)} />
              </div>
            )}

            <div className="space-y-2">
              {ruleList.map((rule) =>
                editing === rule.key ? (
                  <RuleEditor key={rule.key} extensions={extensions} existing={rule} onSave={handleSaveRule} onCancel={() => setEditing(null)} />
                ) : (
                  <div key={rule.key} className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-100">{rule.key}</p>
                      <p className="text-xs text-zinc-500">
                        {rule.exact ? 'This page only' : 'Entire domain'} · {rule.extensionIds.length} extension
                        {rule.extensionIds.length === 1 ? '' : 's'} enabled
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditing(rule.key)}
                        className="rounded px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRule(rule.key)}
                        className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ),
              )}
              {ruleList.length === 0 && editing !== 'new' && <p className="text-sm text-zinc-500">No site rules configured yet.</p>}
            </div>
          </section>

          <BackupSection onImported={refresh} />

          <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-xs text-zinc-500">
            <h2 className="mb-1 text-sm font-semibold text-zinc-100">Why these permissions</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <span className="text-zinc-300">management</span> — required to read your installed extensions and enable/disable
                them. This is the core feature; there's no narrower permission that grants it.
              </li>
              <li>
                <span className="text-zinc-300">tabs</span> — required to read the active tab's URL so a badge can show when the
                current site has pending changes. We never read page content and request no host permissions.
              </li>
              <li>
                <span className="text-zinc-300">storage</span> — your site rules and always-on pins, stored locally in this
                browser only. Nothing is sent anywhere. See PRIVACY.md in the extension's source.
              </li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
