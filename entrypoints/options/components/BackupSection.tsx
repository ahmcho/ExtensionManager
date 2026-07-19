import { useRef, useState } from 'react';
import { exportState, importState } from '@/lib/storage';

interface BackupSectionProps {
  onImported: () => void;
}

export function BackupSection({ onImported }: BackupSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    const state = await exportState();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extension-manager-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('Exported.');
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await importState(parsed);
      onImported();
      setMessage('Imported successfully.');
    } catch (err) {
      setMessage(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="mb-1 text-sm font-semibold text-zinc-100">Backup</h2>
      <p className="mb-3 text-xs text-zinc-500">
        Rules are stored locally in this browser only (not synced). Export a backup before reinstalling, or to move rules to
        another machine.
      </p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleExport} className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600">
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600"
        >
          Import JSON
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = '';
          }}
        />
        {message && <span className="text-xs text-zinc-400">{message}</span>}
      </div>
    </section>
  );
}
