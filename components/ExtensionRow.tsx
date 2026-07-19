import type { ReactNode } from 'react';
import type { ManagedExtension } from '@/lib/types';

const PUZZLE_PIECE_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='1.5'%3E%3Cpath d='M10 3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.17a2 2 0 0 0 2 2H17a2 2 0 0 1 2 2v1.83a1 1 0 0 1-1 1h-1.17a2 2 0 0 0 0 4H18a1 1 0 0 1 1 1V18a2 2 0 0 1-2 2h-1.83a2 2 0 0 0-2-2v1.17a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V18a2 2 0 0 0-2-2H6a2 2 0 0 1-2-2v-1.83a1 1 0 0 1 1-1h1.17a2 2 0 0 0 0-4H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h1.83a2 2 0 0 0 2-2V3z'/%3E%3C/svg%3E";

interface ExtensionRowProps {
  extension: ManagedExtension;
  right: ReactNode;
  subtitle?: ReactNode;
}

export function ExtensionRow({ extension, right, subtitle }: ExtensionRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-zinc-800/60">
      <img
        src={extension.iconUrl || PUZZLE_PIECE_FALLBACK}
        alt=""
        className="h-6 w-6 shrink-0 rounded"
        onError={(e) => {
          e.currentTarget.src = PUZZLE_PIECE_FALLBACK;
        }}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">{extension.shortName}</p>
        {subtitle ? (
          <div className="truncate text-xs text-zinc-400">{subtitle}</div>
        ) : !extension.mayDisable ? (
          <p className="truncate text-xs text-amber-400/90">Locked by admin policy</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </div>
  );
}
