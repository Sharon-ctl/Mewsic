import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useStore } from "../../store";

interface AppStats {
  cpu: number;
  memory: number;
}

export function DevOverlay() {
  const [stats, setStats] = useState<AppStats | null>(null);
  const isDevMode = useStore(s => s.isDevMode);

  useEffect(() => {
    if (!isDevMode) {
      setStats(null);
      return;
    }

    const unlisten = listen<AppStats>('app-stats', (event) => {
      setStats(event.payload);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [isDevMode]);

  if (!isDevMode || !stats) return null;

  const memMB = (stats.memory / (1024 * 1024)).toFixed(1);
  const cpuPercent = stats.cpu.toFixed(1);

  return (
    <div className="fixed bottom-32 left-10 z-[9999] pointer-events-none">
      <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-lg px-3 py-2 flex flex-col gap-1 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">CPU</span>
          <span className={`text-xs font-mono font-bold ${stats.cpu > 50 ? 'text-red-400' : 'text-accent'}`}>
            {cpuPercent}%
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">RAM</span>
          <span className="text-xs font-mono font-bold text-accent">
            {memMB} MB
          </span>
        </div>
      </div>
    </div>
  );
}
