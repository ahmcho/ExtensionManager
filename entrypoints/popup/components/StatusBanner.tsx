import type { ApplyResult } from '@/lib/management';

interface StatusBannerProps {
  applying: boolean;
  appliedCount: number;
  failures: ApplyResult['failed'];
  onRetry: () => void;
}

export function StatusBanner({ applying, appliedCount, failures, onRetry }: StatusBannerProps) {
  if (applying) {
    return (
      <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-800/60 px-3 py-2 text-xs text-zinc-300">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-500 border-t-indigo-400" />
        Syncing extensions for this site…
      </div>
    );
  }

  if (failures.length > 0) {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
        <span>
          {failures.length} change{failures.length > 1 ? 's' : ''} didn't apply ({failures[0].error.slice(0, 60)}
          {failures[0].error.length > 60 ? '…' : ''})
        </span>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded bg-amber-500/20 px-2 py-1 font-medium text-amber-200 hover:bg-amber-500/30"
        >
          Retry
        </button>
      </div>
    );
  }

  if (appliedCount > 0) {
    return (
      <div className="border-b border-zinc-800 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
        Synced {appliedCount} extension{appliedCount > 1 ? 's' : ''} for this site.
      </div>
    );
  }

  return null;
}
