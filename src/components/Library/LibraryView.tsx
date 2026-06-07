import React, { useMemo, useState, useCallback, useRef, useEffect, memo } from "react";
import { List as VList } from "react-window";
import {
  Search, LayoutGrid, List, SlidersHorizontal,
  Music2, RefreshCw, Plus, PlusCircle, ChevronDown, ArrowUp, ArrowDown
} from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { importFiles, deleteTrack } from "../../utils/tauriApi";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { MusicCard } from "../Dashboard/MusicCard";
import { useLibrary } from "../../hooks/useLibrary";
import { AddToPlaylistModal } from "./AddToPlaylistModal";
import { EditMetadataModal } from "./EditMetadataModal";
import type { Track } from "../../types";

const LIST_ITEM_HEIGHT = 80; // px per row in list view
type SortKey = "title" | "artist" | "album" | "duration";

const ListContent = memo(function ListContent({
  tracks,
  onAddToPlaylist,
  onEditMetadata,
  onDelete,
  height,
}: {
  tracks: Track[];
  onAddToPlaylist: (track: Track) => void;
  onEditMetadata: (track: Track) => void;
  onDelete: (track: Track) => void;
  height: number;
}) {
  // react-window v2 uses rowComponent instead of children
  const RowComponent = useCallback(
    (props: { index: number; style: React.CSSProperties; ariaAttributes: any }) => {
      const track = tracks[props.index];
      if (!track) return null;
      return (
        <div style={props.style} className="py-1 px-1">
          <MusicCard
            key={track.id}
            track={track}
            allTracks={tracks}
            trackIndex={props.index}
            sourceId="library"
            viewMode="list"
            onAddToPlaylist={onAddToPlaylist}
            onEditMetadata={onEditMetadata}
            onDelete={onDelete}
          />
        </div>
      );
    },
    [tracks, onAddToPlaylist, onEditMetadata, onDelete]
  );

  const listRef = useRef<any>(null);
  const isRestoringRef = useRef(true);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    if (listRef.current && tracks.length > 0 && height > 0) {
      const saved = useStore.getState().libraryListScrollOffset;
      listRef.current.scrollTo(saved);
      hasRestoredRef.current = true;
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 100);
    }
  }, [tracks.length, height]);

  const handleScroll = useCallback(({ scrollOffset }: { scrollOffset: number }) => {
    if (isRestoringRef.current) return;
    useStore.getState().setLibraryListScrollOffset(scrollOffset);
  }, []);

  const VListElement = VList as any;
  return (
    <VListElement
      ref={listRef}
      style={{ height }}
      rowComponent={RowComponent as any}
      rowCount={tracks.length}
      rowHeight={LIST_ITEM_HEIGHT}
      rowProps={{} as any}
      overscanCount={5}
      onScroll={handleScroll as any}
    />
  );
});

const GRID_PAGE_SIZE = 60;

const GridContent = memo(function GridContent({
  tracks,
  onAddToPlaylist,
  onEditMetadata,
  onDelete,
  width,
  height,
}: {
  tracks: Track[];
  onAddToPlaylist: (track: Track) => void;
  onEditMetadata: (track: Track) => void;
  onDelete: (track: Track) => void;
  width: number;
  height: number;
}) {
  const GRID_GAP = 16;
  const MIN_CARD_WIDTH = 180;
  
  // Calculate columns based on available width (minus padding)
  const availableWidth = width - 64; // px-8 on both sides
  const columns = Math.max(1, Math.floor((availableWidth + GRID_GAP) / (MIN_CARD_WIDTH + GRID_GAP)));
  const rowCount = Math.ceil(tracks.length / columns);
  const rowHeight = 310; // Increased height to prevent clipping

  const RowComponent = useCallback(
    (props: { index: number; style: React.CSSProperties }) => {
      const startIndex = props.index * columns;
      const rowTracks = tracks.slice(startIndex, startIndex + columns);

      return (
        <div style={props.style} className="px-8 py-4">
          <div 
            className="grid gap-4" 
            style={{ 
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` 
            }}
          >
            {rowTracks.map((track, i) => (
              <MusicCard
                key={track.id}
                track={track}
                allTracks={tracks}
                trackIndex={startIndex + i}
                sourceId="library"
                viewMode="grid"
                onAddToPlaylist={onAddToPlaylist}
                onEditMetadata={onEditMetadata}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      );
    },
    [tracks, columns, onAddToPlaylist, onEditMetadata, onDelete]
  );

  const listRef = useRef<any>(null);
  const isRestoringRef = useRef(true);
  const hasRestoredRef = useRef(false);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    if (listRef.current && tracks.length > 0 && height > 0) {
      const saved = useStore.getState().libraryGridScrollOffset;
      listRef.current.scrollTo(saved);
      hasRestoredRef.current = true;
      setTimeout(() => {
        isRestoringRef.current = false;
      }, 100);
    }
  }, [tracks.length, height]);

  const handleScroll = useCallback(({ scrollOffset }: { scrollOffset: number }) => {
    if (isRestoringRef.current) return;
    useStore.getState().setLibraryGridScrollOffset(scrollOffset);
  }, []);

  const VListElement = VList as any;
  return (
    <VListElement
      ref={listRef}
      style={{ height, width: "100%" }}
      rowComponent={RowComponent as any}
      rowCount={rowCount}
      rowHeight={rowHeight}
      rowProps={{} as any}
      overscanCount={2}
      onScroll={handleScroll as any}
    />
  );
});

import { useDisplayData } from "../../hooks/useDisplayData";

export function LibraryView() {
  const {
    isScanning, searchQuery, setSearchQuery, musicDir,
    libraryViewMode, setLibraryViewMode, removeTrack, addNotification,
    setAddTrack, setEditTrack, setDeleteTrack
  } = useStore(useShallow((s) => ({
    isScanning: s.isScanning,
    searchQuery: s.searchQuery,
    setSearchQuery: s.setSearchQuery,
    musicDir: s.musicDir,
    libraryViewMode: s.libraryViewMode,
    setLibraryViewMode: s.setLibraryViewMode,
    removeTrack: s.removeTrack,
    addNotification: s.addNotification,
    setAddTrack: s.setAddTrack,
    setEditTrack: s.setEditTrack,
    setDeleteTrack: s.setDeleteTrack,
  })));

  const { displayTracks, demoTrackCount } = useDisplayData();
  const { rescanDirectory } = useLibrary();

  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortAsc, setSortAsc] = useState(true);
  const [addTracks, setAddTracks] = useState<Track[] | null>(null);


  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [listHeight, setListHeight] = useState(600);
  const [listWidth, setListWidth] = useState(800);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 150);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localSearch, setSearchQuery]);

  // Measure container height for the virtual list
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setListHeight(entry.contentRect.height);
        setListWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setListHeight(el.clientHeight);
    setListWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const toggleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortAsc((a) => !a);
    else { setSortKey(key); setSortAsc(true); }
  }, [sortKey]);

  const handleAddToPlaylist = useCallback((track: Track) => {
    setAddTrack(track);
  }, [setAddTrack]);

  const handleEditMetadata = useCallback((track: Track) => {
    setEditTrack(track);
  }, [setEditTrack]);

  const handleDeleteTrack = useCallback(async (track: Track) => {
    setDeleteTrack(track);
  }, [setDeleteTrack]);


  const handleImport = async () => {
    if (!musicDir) return;
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Music', extensions: ['mp3', 'flac', 'ogg', 'wav', 'm4a', 'aac', 'opus', 'wma', 'aiff'] }]
      });

      if (selected && Array.isArray(selected) && selected.length > 0) {
        const count = await importFiles(selected, musicDir);
        if (count > 0) {
          rescanDirectory();
        }
      }
    } catch (err) {
      console.error("Import error:", err);
    }
  };

  const filtered = useMemo(() => {
    const q = localSearch.toLowerCase();
    let list = q
      ? displayTracks.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            t.artist.toLowerCase().includes(q) ||
            t.album.toLowerCase().includes(q)
        )
      : [...displayTracks];

    list.sort((a, b) => {
      const av = String(a[sortKey] ?? "");
      const bv = String(b[sortKey] ?? "");
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      if (cmp !== 0) return sortAsc ? cmp : -cmp;
      return a.id.localeCompare(b.id);
    });
    return list;
  }, [displayTracks, localSearch, sortKey, sortAsc]);



  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row flex-wrap md:items-center gap-4 w-full px-4 md:px-8 py-4 md:py-6 flex-shrink-0">
        {/* Search */}
        <div className="relative group flex-grow min-w-[200px]">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent transition-colors"
          />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search your library…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-surface-overlay border border-border-subtle text-text-primary placeholder-text-muted outline-none focus:border-accent/40 focus:ring-4 focus:ring-accent/5 transition-all"
          />
        </div>

        <div className="hidden lg:block h-6 w-px bg-border-subtle mx-2 flex-shrink-0" />

        <div className="flex flex-wrap items-center justify-between md:justify-end gap-4 w-full md:w-auto flex-shrink-0">
          {/* Sort controls */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-wider text-text-muted mr-1">Sort by</span>
            <SortDropdown sortKey={sortKey} sortAsc={sortAsc} toggleSort={toggleSort} />
          </div>

          {/* View toggle & Actions */}
          <div className="flex items-center gap-2 ml-auto md:ml-0">
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-surface-raised border border-border-subtle rounded-xl p-1">
              <button
                onClick={() => setLibraryViewMode("list")}
                className={`btn-icon ${libraryViewMode === "list" ? "bg-surface-overlay text-accent shadow-sm" : ""}`}
                title="List view"
              >
                <List size={15} />
              </button>
              <button
                onClick={() => setLibraryViewMode("grid")}
                className={`btn-icon ${libraryViewMode === "grid" ? "bg-surface-overlay text-accent shadow-sm" : ""}`}
                title="Grid view"
              >
                <LayoutGrid size={15} />
              </button>
            </div>

            {/* Rescan */}
            <button
              onClick={() => musicDir && rescanDirectory()}
              disabled={isScanning}
              className="btn-icon bg-surface-raised border border-border-subtle rounded-xl w-10 h-10"
              title="Rescan library"
            >
              <RefreshCw size={15} className={isScanning ? "animate-spin text-accent" : ""} />
            </button>

            {/* Import */}
            <button
              onClick={handleImport}
              className="btn-accent h-10 px-4 flex-shrink-0"
              title="Import music to library"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">Import</span>
            </button>
          </div>
        </div>
      </div>

      {/* Track count */}
      <div className="px-6 py-2 text-xs text-text-muted flex-shrink-0">
        {filtered.length === displayTracks.length
          ? `${demoTrackCount} tracks`
          : `${filtered.length} of ${demoTrackCount} tracks`}
      </div>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="empty-state pt-16">
            <Music2 size={40} className="text-text-muted" />
            <div>
              <p className="text-text-secondary font-medium">No tracks found</p>
              <p className="text-text-muted text-sm">
                {localSearch ? "Try a different search" : "Add music to your library"}
              </p>
            </div>
          </div>
        ) : libraryViewMode === "list" ? (
          <div className="px-8 pb-4 h-full">
            <ListContent tracks={filtered} onAddToPlaylist={handleAddToPlaylist} onEditMetadata={handleEditMetadata} onDelete={handleDeleteTrack} height={listHeight} />
          </div>
        ) : (
          <div className="h-full">
            <GridContent 
              tracks={filtered} 
              onAddToPlaylist={handleAddToPlaylist} 
              onEditMetadata={handleEditMetadata} 
              onDelete={handleDeleteTrack} 
              width={listWidth}
              height={listHeight}
            />
          </div>
        )}
      </div>
      {addTracks && (
        <AddToPlaylistModal
          tracks={addTracks}
          onClose={() => setAddTracks(null)}
        />
      )}
    </div>
  );
}

function SortDropdown({
  sortKey,
  sortAsc,
  toggleSort,
}: {
  sortKey: SortKey;
  sortAsc: boolean;
  toggleSort: (k: SortKey) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  
  const options: { k: SortKey; label: string }[] = [
    { k: "title", label: "Title" },
    { k: "artist", label: "Artist" },
    { k: "album", label: "Album" },
    { k: "duration", label: "Time" },
  ];

  const currentOpt = options.find((o) => o.k === sortKey) || options[0];

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = () => setIsOpen(false);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [isOpen]);

  return (
    <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 bg-surface-raised border ${isOpen ? 'border-accent ring-2 ring-accent/20' : 'border-border-subtle hover:border-text-muted'} rounded-xl px-3 py-2 transition-all text-xs font-medium justify-between group shadow-sm min-w-[110px]`}
      >
        <span className="text-text-primary flex items-center gap-1.5">
          {currentOpt.label}
          {sortAsc ? <ArrowUp size={12} className="text-accent" /> : <ArrowDown size={12} className="text-accent" />}
        </span>
        <ChevronDown size={14} className={`text-text-muted transition-transform duration-300 ${isOpen ? 'rotate-180 text-accent' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-36 bg-surface-overlay border border-border-glass rounded-xl overflow-hidden shadow-2xl z-50 animate-scale-in p-1.5 backdrop-blur-xl">
          {options.map((o) => (
            <button
              key={o.k}
              onClick={() => {
                toggleSort(o.k);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                sortKey === o.k 
                  ? 'bg-accent/10 text-accent font-bold' 
                  : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
              }`}
            >
              <span>{o.label}</span>
              {sortKey === o.k && (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}