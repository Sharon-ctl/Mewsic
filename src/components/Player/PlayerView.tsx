import React, { useState, useMemo, useEffect } from "react";
import { Lyrics, LyricLine } from "./Lyrics";
import { useStore } from "../../store";
import { saveTrackMetadata } from "../../utils/tauriApi";
import { Edit3, Check, X } from "lucide-react";

export function PlayerView() {
  const currentTrack = useStore(s => s.currentTrack);
  const updateTrack = useStore(s => s.updateTrack);
  const lyrics = currentTrack?.lyrics;
  
  const isSynced = useMemo(() => {
    if (!lyrics) return false;
    return /\[\d{2}:\d{2}\.\d{2,3}\]/.test(lyrics);
  }, [lyrics]);

  const [autoScroll, setAutoScroll] = useState(isSynced);
  const [isSyncMode, setIsSyncMode] = useState(false);
  const [syncLines, setSyncLines] = useState<LyricLine[]>([]);

  useEffect(() => {
    setAutoScroll(isSynced);
    setIsSyncMode(false);
  }, [isSynced, currentTrack?.id]);

  const startSyncMode = () => {
    if (!currentTrack) return;
    const currentLyrics = lyrics || "";
    const rawLines = currentLyrics.split("\n").filter(l => l.trim()) || [];
    const initial = rawLines.map(line => {
      const match = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/.exec(line);
      if (match) {
        const m = parseInt(match[1], 10);
        const s = parseInt(match[2], 10);
        const ms = parseInt(match[3].padEnd(3, "0"), 10);
        return { time: m * 60 + s + ms / 1000, text: match[4].trim() };
      }
      return { time: -1, text: line.trim() };
    });
    setSyncLines(initial);
    setIsSyncMode(true);
  };

  const shiftSync = (amount: number) => {
    setSyncLines(lines => lines.map(l => ({
      ...l,
      time: l.time >= 0 ? Math.max(0, l.time + amount) : -1
    })));
  };

  const saveSync = async () => {
    if (!currentTrack) return;
    const lrcContent = syncLines.map(l => {
      if (l.time < 0) return l.text;
      const m = Math.floor(l.time / 60).toString().padStart(2, "0");
      const s = Math.floor(l.time % 60).toString().padStart(2, "0");
      const ms = Math.floor((l.time % 1) * 100).toString().padStart(2, "0");
      return `[${m}:${s}.${ms}] ${l.text}`;
    }).join("\n");

    try {
      await saveTrackMetadata(currentTrack.filePath, { lyrics: lrcContent });
      updateTrack({ ...currentTrack, lyrics: lrcContent });
      setIsSyncMode(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border-subtle flex-shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-muted uppercase tracking-widest">
          {isSyncMode ? "Sync Mode" : "Lyrics"}
        </h2>
        <div className="flex items-center gap-2">
          {isSyncMode ? (
            <>
              <div className="flex items-center gap-1 mr-2 border-r border-border-subtle pr-3">
                <button
                  onClick={() => shiftSync(-1.0)}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary"
                  title="Advance lyrics by 1.0s"
                >
                  -1.0s
                </button>
                <button
                  onClick={() => shiftSync(-0.5)}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary"
                  title="Advance lyrics by 0.5s"
                >
                  -0.5s
                </button>
                <button
                  onClick={() => shiftSync(-0.1)}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary"
                  title="Advance lyrics by 0.1s"
                >
                  -0.1s
                </button>
                <button
                  onClick={() => shiftSync(0.1)}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary"
                  title="Delay lyrics by 0.1s"
                >
                  +0.1s
                </button>
                <button
                  onClick={() => shiftSync(0.5)}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary"
                  title="Delay lyrics by 0.5s"
                >
                  +0.5s
                </button>
                <button
                  onClick={() => shiftSync(1.0)}
                  className="px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary"
                  title="Delay lyrics by 1.0s"
                >
                  +1.0s
                </button>
              </div>
              <button
                onClick={() => setIsSyncMode(false)}
                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary flex items-center gap-1.5"
              >
                <X size={12} />
                Cancel
              </button>
              <button
                onClick={saveSync}
                className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors bg-accent text-black border border-accent hover:opacity-80 flex items-center gap-1.5"
              >
                <Check size={12} />
                Save
              </button>
            </>
          ) : (
            <>
              {currentTrack && (
                <button
                  onClick={startSyncMode}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary hover:border-text-muted flex items-center gap-1.5"
                  title="Enter Sync Mode"
                >
                  <Edit3 size={12} />
                  Sync
                </button>
              )}
              {lyrics && (
                <button 
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors ${autoScroll ? "bg-accent text-black shadow-[0_0_10px_rgba(var(--accent-rgb),0.3)]" : "bg-surface-raised text-text-muted border border-border-subtle hover:text-text-primary hover:border-text-muted"} disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed`}
                  disabled={!isSynced}
                  title={!isSynced ? "Auto-scroll requires synced lyrics" : "Toggle auto-scroll"}
                >
                  Auto-Scroll {autoScroll ? "ON" : "OFF"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <Lyrics autoScroll={autoScroll} isSyncMode={isSyncMode} syncLines={syncLines} setSyncLines={setSyncLines} />
      </div>
    </div>
  );
}