import { useMemo, useState } from 'react';
import { parseDomainInput, ruleTargetFor } from '@/lib/domain';
import type { DomainRule, ManagedExtension } from '@/lib/types';

interface RuleEditorProps {
  extensions: ManagedExtension[];
  existing?: DomainRule;
  onSave: (rule: DomainRule) => void;
  onCancel: () => void;
}

export function RuleEditor({ extensions, existing, onSave, onCancel }: RuleEditorProps) {
  const [domainInput, setDomainInput] = useState(existing?.key ?? '');
  const [granularity, setGranularity] = useState<'hostname' | 'registrable'>(
    existing ? (existing.exact ? 'hostname' : 'registrable') : 'registrable',
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(existing?.extensionIds ?? []));

  const site = useMemo(() => (existing ? null : parseDomainInput(domainInput)), [domainInput, existing]);
  const isEditingExisting = !!existing;
  const canUseDomainGranularity = !isEditingExisting && !!site?.registrable && site.registrable !== site.hostname;

  const target = existing
    ? { key: existing.key, exact: existing.exact }
    : site
      ? ruleTargetFor(site, granularity)
      : null;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSave() {
    if (!target) return;
    onSave({ key: target.key, exact: target.exact, extensionIds: [...selected], updatedAt: Date.now() });
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
      <h3 className="mb-3 text-sm font-semibold text-zinc-100">
        {isEditingExisting ? `Edit rule for ${existing!.key}` : 'Add a site rule'}
      </h3>

      {!isEditingExisting && (
        <div className="mb-3">
          <label htmlFor="rule-domain-input" className="mb-1 block text-xs font-medium text-zinc-400">
            Domain or hostname
          </label>
          <input
            id="rule-domain-input"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="example.com or mail.example.com"
            className="w-full rounded bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 outline-none ring-1 ring-zinc-700 focus:ring-indigo-400"
          />
          {domainInput.trim() && !site && <p className="mt-1 text-xs text-red-400">That doesn't look like a valid domain.</p>}
        </div>
      )}

      {site && canUseDomainGranularity && (
        <div className="mb-3 flex gap-1 text-xs">
          <button
            type="button"
            onClick={() => setGranularity('hostname')}
            className={`rounded-full px-2 py-0.5 ${granularity === 'hostname' ? 'bg-indigo-500 text-white' : 'bg-zinc-700 text-zinc-300'}`}
          >
            Just {site.hostname}
          </button>
          <button
            type="button"
            onClick={() => setGranularity('registrable')}
            className={`rounded-full px-2 py-0.5 ${granularity === 'registrable' ? 'bg-indigo-500 text-white' : 'bg-zinc-700 text-zinc-300'}`}
          >
            All of {site.registrable}
          </button>
        </div>
      )}

      <p className="mb-1 text-xs font-medium text-zinc-400">
        Extensions to keep enabled on {target?.key ?? 'this site'} (everything else gets disabled):
      </p>
      <div className="mb-4 max-h-56 overflow-y-auto rounded border border-zinc-700">
        {extensions.map((ext) => (
          <label key={ext.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-700/50">
            <input type="checkbox" checked={selected.has(ext.id)} onChange={() => toggle(ext.id)} className="accent-indigo-500" />
            <span className="truncate">{ext.name}</span>
            {!ext.mayDisable && <span className="ml-auto shrink-0 text-xs text-amber-400">locked</span>}
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700">
          Cancel
        </button>
        <button
          type="button"
          disabled={!target}
          onClick={handleSave}
          className="rounded bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save rule
        </button>
      </div>
    </div>
  );
}
