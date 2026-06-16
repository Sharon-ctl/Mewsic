import { useStore } from "../store";
import type { Track } from "../types";
import { version } from "../../package.json";

declare global {
  interface Window {
    Mewsic: any;
  }
}

export function initPluginApi() {
  if (window.Mewsic) return;

  const eventListeners: Record<string, Function[]> = {};

  const triggerEvent = (event: string, data: any) => {
    if (eventListeners[event]) {
      eventListeners[event].forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Plugin API event error [${event}]:`, e);
        }
      });
    }
  };

  // Subscribe to store changes to trigger events
  useStore.subscribe((state, prevState) => {
    if (state.currentTrack?.id !== prevState.currentTrack?.id) {
      triggerEvent("track_changed", state.currentTrack);
    }
    if (state.isPlaying !== prevState.isPlaying) {
      triggerEvent("playback_state_changed", state.isPlaying);
    }
    if (state.volume !== prevState.volume) {
      triggerEvent("volume_changed", state.volume);
    }
    if (state.currentTime !== prevState.currentTime) {
      triggerEvent("time_changed", state.currentTime);
    }
    if (state.shuffleEnabled !== prevState.shuffleEnabled) {
      triggerEvent("shuffle_changed", state.shuffleEnabled);
    }
    if (state.repeatMode !== prevState.repeatMode) {
      triggerEvent("repeat_changed", state.repeatMode);
    }
    if (state.activeView !== prevState.activeView) {
      triggerEvent("view_changed", state.activeView);
    }
    if (state.queueSourceId !== prevState.queueSourceId) {
      // Need a helper to get playlist name before window.Mewsic is fully defined (or we can just query the state here)
      const sourceId = state.queueSourceId;
      let playlistName = null;
      if (sourceId && sourceId.startsWith("playlist:")) {
        const playlistId = sourceId.replace("playlist:", "");
        const playlist = state.playlists.find(p => p.id === playlistId);
        playlistName = playlist ? playlist.name : null;
      }
      triggerEvent("playlist_changed", playlistName);
    }
  });

  window.Mewsic = {
    // Application information
    version,

    // Player Controls
    player: {
      play: () => useStore.getState().setIsPlaying(true),
      pause: () => useStore.getState().setIsPlaying(false),
      togglePlay: () => useStore.getState().setIsPlaying(!useStore.getState().isPlaying),
      next: () => useStore.getState().playNext(),
      prev: () => useStore.getState().playPrev(),
      seek: (time: number) => useStore.getState().requestSeek(time),
      setVolume: (volume: number) => useStore.getState().setVolume(volume),
      toggleShuffle: () => useStore.getState().toggleShuffle(),
      setRepeatMode: (mode: "off" | "one" | "all") => useStore.getState().setRepeatMode(mode),
      
      get currentTrack(): Track | null {
        return useStore.getState().currentTrack;
      },
      get isPlaying(): boolean {
        return useStore.getState().isPlaying;
      },
      get volume(): number {
        return useStore.getState().volume;
      },
      get queue(): Track[] {
        return useStore.getState().queue;
      },
      get currentTime(): number {
        return useStore.getState().currentTime;
      },
      get shuffleEnabled(): boolean {
        return useStore.getState().shuffleEnabled;
      },
      get repeatMode(): "off" | "one" | "all" {
        return useStore.getState().repeatMode;
      },
      get currentPlaylistName(): string | null {
        const state = useStore.getState();
        const sourceId = state.queueSourceId;
        if (sourceId && sourceId.startsWith("playlist:")) {
          const playlistId = sourceId.replace("playlist:", "");
          const playlist = state.playlists.find(p => p.id === playlistId);
          return playlist ? playlist.name : null;
        }
        return null;
      },
      playTrack: (trackId: string) => {
        const state = useStore.getState();
        const idx = state.tracks.findIndex((t) => t.id === trackId);
        if (idx !== -1) {
          state.setQueue(state.tracks, idx, "library");
          state.setIsPlaying(true);
        }
      },
      setQueue: (tracks: Track[], startIndex = 0) => {
        useStore.getState().setQueue(tracks, startIndex, "plugin");
      },
      addToQueue: (track: Track) => {
        const state = useStore.getState();
        const newQueue = [...state.queue, track];
        const newOriginal = [...state.originalQueue, track];
        useStore.setState({ queue: newQueue, originalQueue: newOriginal });
      },
      clearQueue: () => {
        useStore.setState({ queue: [], originalQueue: [], currentTrack: null, isPlaying: false, queueIndex: -1 });
      }
    },

    // Library access
    library: {
      get tracks(): Track[] {
        return useStore.getState().tracks;
      },
      get playlists() {
        return useStore.getState().playlists;
      },
      playPlaylist: (playlistId: string) => {
        const state = useStore.getState();
        const playlist = state.playlists.find(p => p.id === playlistId);
        if (playlist && playlist.trackIds.length > 0) {
          const playlistTracks = playlist.trackIds
            .map(id => state.tracks.find(t => t.id === id))
            .filter((t): t is Track => !!t);
          if (playlistTracks.length > 0) {
            state.setQueue(playlistTracks, 0, `playlist:${playlistId}`);
            state.setIsPlaying(true);
          }
        }
      },
      search: (query: string): Track[] => {
        const q = query.toLowerCase();
        return useStore.getState().tracks.filter(t => 
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.artist && t.artist.toLowerCase().includes(q)) ||
          (t.album && t.album.toLowerCase().includes(q))
        );
      }
    },
    
    // UI Interactions
    ui: {
      addNotification: (message: string, type: "info" | "success" | "error" = "info", duration = 5000, title?: string) => {
        return useStore.getState().addNotification(message, type, duration, false, title);
      },
      setTheme: (theme: "dark" | "light") => useStore.getState().setTheme(theme),
      setAccentColor: (color: string) => useStore.getState().setAccentColor(color as any),
      setView: (view: any) => useStore.setState({ activeView: view, activePlaylistId: null, searchQuery: "" }),
      get activeView() {
        return useStore.getState().activeView;
      }
    },

    // Event System
    events: {
      on: (event: string, callback: Function) => {
        if (!eventListeners[event]) {
          eventListeners[event] = [];
        }
        eventListeners[event].push(callback);
      },
      off: (event: string, callback: Function) => {
        if (!eventListeners[event]) return;
        eventListeners[event] = eventListeners[event].filter((cb) => cb !== callback);
      }
    }
  };
}
