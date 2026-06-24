import React, { useEffect, useRef, useMemo, useState } from "react";
import { useStore } from "../../store";

export interface LyricLine {
  time: number;
  text: string;
}

function parseLRC(text: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d+):(\d{2})(?:\.(\d+))?\](.*)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const msStr = match[3] || "0";
    const ms = parseInt(msStr.padEnd(3, "0").slice(0, 3), 10);
    const time = minutes * 60 + seconds + ms / 1000;
    const lyricText = match[4].trim();
    if (lyricText) {
      lines.push({ time, text: lyricText });
    }
  }

  lines.sort((a, b) => a.time - b.time);
  return lines;
}

function animateScrollLerp(element: HTMLDivElement, target: number, speed: number = 0.08) {
  let frameId: number;
  
  const step = () => {
    const current = element.scrollTop;
    const diff = target - current;
    
    if (Math.abs(diff) < 0.5) {
      element.scrollTop = target;
    } else {
      element.scrollTop = current + diff * speed;
      frameId = requestAnimationFrame(step);
    }
  };
  
  frameId = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frameId);
}

export function Lyrics({ 
  autoScroll = true,
  isSyncMode = false,
  syncLines = [],
  setSyncLines
}: { 
  autoScroll?: boolean;
  isSyncMode?: boolean;
  syncLines?: LyricLine[];
  setSyncLines?: (lines: LyricLine[]) => void;
}) {
  const currentTrack = useStore(s => s.currentTrack);
  const requestSeek = useStore(s => s.requestSeek);
  
  const [activeIndex, setActiveIndex] = useState(-1);
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const currentTimeRef = useRef(0);
  const scrollAnimRef = useRef<(() => void) | null>(null);

  const lyrics = currentTrack?.lyrics;

  const isSynced = useMemo(() => {
    if (!lyrics) return false;
    return /\[\d+:\d{2}(?:\.\d+)?\]/.test(lyrics);
  }, [lyrics]);

  const parsedLyrics = useMemo(() => {
    if (!lyrics) return [];
    if (!isSynced) {
      return lyrics.split("\n").map(text => ({ time: 0, text }));
    }
    return parseLRC(lyrics);
  }, [lyrics, isSynced]);

  // High-performance direct DOM subscription to eliminate 20fps React re-renders on i3-4150
  useEffect(() => {
    currentTimeRef.current = useStore.getState().currentTime;
    
    const unsub = useStore.subscribe((state) => {
      const time = state.currentTime;
      currentTimeRef.current = time;

      // Update sync mode timer badge directly
      if (isSyncMode && timeDisplayRef.current) {
        const m = Math.floor(time / 60).toString().padStart(2, '0');
        const s = Math.floor(time % 60).toString().padStart(2, '0');
        timeDisplayRef.current.textContent = `${m}:${s}`;
      }

      // Update active index for playback mode smoothly
      if (!isSyncMode && parsedLyrics.length > 0 && isSynced) {
        let active = 0;
        for (let i = 0; i < parsedLyrics.length; i++) {
          if (parsedLyrics[i].time <= time) {
            active = i;
          } else {
            break;
          }
        }
        setActiveIndex(prev => prev !== active ? active : prev);
      }
    });
    
    return unsub;
  }, [isSyncMode, parsedLyrics, isSynced]);

  // Handle smooth scrolling
  useEffect(() => {
    if (autoScroll && isSynced && activeRef.current && containerRef.current && !isSyncMode) {
      const container = containerRef.current;
      const activeEl = activeRef.current;

      const containerHeight = container.clientHeight;
      const activeHeight = activeEl.clientHeight;
      const activeTop = activeEl.offsetTop;
      const targetTop = activeTop - (containerHeight / 2) + (activeHeight / 2);

      if (scrollAnimRef.current) {
        scrollAnimRef.current();
      }

      scrollAnimRef.current = animateScrollLerp(container, targetTop, 0.08);
    }

    return () => {
      if (scrollAnimRef.current) {
        scrollAnimRef.current();
      }
    };
  }, [activeIndex, isSynced, autoScroll, isSyncMode]);

  if (isSyncMode && setSyncLines) {
    return (
      <div className="h-full overflow-y-auto scrollbar-hide relative" style={{ paddingBottom: '30vh' }}>
        <div className="sticky top-0 z-10 pt-8 pb-6 px-4 sm:px-8 bg-surface-base">
          <div className="bg-surface-overlay/80 backdrop-blur-xl py-3 px-4 rounded-xl border border-border-glass shadow-glass flex items-center justify-between">
            <p className="text-text-primary text-xs font-medium">
              Click a line to assign time. <span className="text-text-muted hidden md:inline">Ctrl+Click to seek.</span>
            </p>
            <span 
              ref={timeDisplayRef}
              className="text-accent font-mono text-sm font-bold bg-black/20 px-3 py-1 rounded-lg"
            >
              00:00
            </span>
          </div>
        </div>
        <div className="space-y-1.5">
          {syncLines.map((line, i) => {
            const isLineSynced = line.time >= 0;
            return (
              <div
                key={i}
                className={`py-3 flex items-center justify-between rounded-xl transition-all hover:bg-surface-raised/50 hover:scale-[1.01] cursor-pointer group px-6 mx-4 sm:mx-8 ${isLineSynced ? 'bg-surface-raised/20 border border-border-subtle/50' : 'border border-transparent'}`}
                onClick={(e) => {
                  if (e.ctrlKey) {
                    if (isLineSynced) requestSeek(line.time);
                    return;
                  }
                  const newLines = [...syncLines];
                  newLines[i] = { ...newLines[i], time: currentTimeRef.current };
                  setSyncLines(newLines);
                }}
              >
                <p className={`text-[15px] leading-relaxed flex-1 transition-colors ${isLineSynced ? "text-accent font-medium" : "text-text-muted group-hover:text-text-primary"}`}>
                  {line.text}
                </p>
                <span className="text-xs font-mono text-text-muted w-16 text-right opacity-50 group-hover:opacity-100 transition-opacity">
                  {isLineSynced 
                    ? `${Math.floor(line.time / 60).toString().padStart(2, '0')}:${Math.floor(line.time % 60).toString().padStart(2, '0')}.${Math.floor((line.time % 1)*100).toString().padStart(2, '0')}` 
                    : "--:--.--"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (!lyrics) {
    return (
      <div className="flex items-center justify-center h-full w-full p-8 animate-fade-in">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-black tracking-tight text-text-primary">No Lyrics Available</h2>
          <p className="text-sm text-text-muted max-w-sm mx-auto leading-relaxed font-medium">
            We couldn't find any lyrics for the currently playing track.
            <br /><br />
            If you have the lyrics, you can easily embed them into the audio file using the built-in metadata editor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full overflow-y-auto py-16">
      {parsedLyrics.map((line, i) => (
        <div
          key={i}
          ref={i === activeIndex ? activeRef : undefined}
          className="py-1 flex justify-center"
        >
          <span
            onClick={() => isSynced && requestSeek(line.time)}
            className={`text-base px-6 py-2.5 text-center rounded-xl transition-all duration-300 inline-block max-w-[90%] ${
              isSynced ? "cursor-pointer hover:bg-surface-raised/30 hover:scale-[1.02] active:scale-[0.98]" : ""
            } ${
              !isSynced
                ? "text-text-primary"
                : i === activeIndex
                ? "text-accent font-semibold scale-105"
                : "text-text-muted/50 hover:text-text-primary"
            }`}
          >
            {line.text}
          </span>
        </div>
      ))}
    </div>
  );
}