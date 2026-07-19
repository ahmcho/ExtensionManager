import type { SiteKeys } from '@/lib/domain';

interface SiteHeaderProps {
  site: SiteKeys;
  granularity: 'hostname' | 'registrable';
  onGranularityChange: (g: 'hostname' | 'registrable') => void;
  hasRule: boolean;
  onClearRule: () => void;
}

export function SiteHeader({ site, granularity, onGranularityChange, hasRule, onClearRule }: SiteHeaderProps) {
  const canUseDomain = site.registrable !== null && site.registrable !== site.hostname;

  return (
    <div className="border-b border-zinc-800 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-zinc-100" title={site.hostname}>
          {site.hostname}
        </p>
        {hasRule && (
          <button
            type="button"
            onClick={onClearRule}
            className="shrink-0 text-xs text-zinc-500 underline decoration-dotted hover:text-zinc-300"
            title="Stop managing extensions for this site (leaves current state as-is)"
          >
            Clear rule
          </button>
        )}
      </div>
      <div className="mt-1.5 flex gap-1 text-xs">
        <button
          type="button"
          onClick={() => onGranularityChange('hostname')}
          className={`rounded-full px-2 py-0.5 transition-colors ${
            granularity === 'hostname' ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          Just this page
        </button>
        {canUseDomain && (
          <button
            type="button"
            onClick={() => onGranularityChange('registrable')}
            className={`rounded-full px-2 py-0.5 transition-colors ${
              granularity === 'registrable' ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            All of {site.registrable}
          </button>
        )}
      </div>
    </div>
  );
}
