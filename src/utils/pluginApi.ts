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
  
  // Storage API internal helper
  const getPluginStoragePrefix = (pluginId?: string) => `mewsic_plugin_${pluginId || 'global'}_`;

  const eventListeners: Record<string, Function[]> = {};
  
  // Registry for custom UI elements
  const uiRegistry = {
    sidebarComponents: new Map<string, any>(),
    views: new Map<string, { render: (container: HTMLElement) => void; cleanup?: () => void }>(),
    overlays: new Map<string, HTMLElement>(),
  };

  // Helper to trigger UI updates
  const triggerUiUpdate = () => {
    window.dispatchEvent(new CustomEvent("plugin-ui-updated"));
  };

  const triggerEvent = (event: string, data?: any) => {
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
    // Queue changed event
    if (state.queue !== prevState.queue) {
      triggerEvent("queue_changed", state.queue);
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
      fadeVolume: (targetVolume: number, duration: number) => {
        const state = useStore.getState();
        const startVolume = state.volume;
        const startTime = performance.now();
        const easeOutQuad = (t: number) => t * (2 - t);
        
        const animate = (currentTime: number) => {
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easedProgress = easeOutQuad(progress);
          const currentVol = startVolume + (targetVolume - startVolume) * easedProgress;
          
          state.setVolume(currentVol);
          
          if (progress < 1) {
            requestAnimationFrame(animate);
          }
        };
        requestAnimationFrame(animate);
      },
      setPlaybackRate: (speed: number) => useStore.getState().setPlaybackSpeed(speed),
      toggleShuffle: () => useStore.getState().toggleShuffle(),
      setRepeatMode: (mode: "off" | "one" | "all") => useStore.getState().setRepeatMode(mode),
      
      getState: () => {
        const s = useStore.getState();
        return {
          currentTrack: s.currentTrack,
          isPlaying: s.isPlaying,
          volume: s.volume,
          queue: s.queue,
          currentTime: s.currentTime,
          duration: s.duration,
          shuffleEnabled: s.shuffleEnabled,
          repeatMode: s.repeatMode,
          activeView: s.activeView,
          queueSourceId: s.queueSourceId,
        };
      },
      
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
      playTrack: async (trackId: string): Promise<void> => {
        return new Promise((resolve) => {
          const state = useStore.getState();
          const idx = state.tracks.findIndex((t) => t.id === trackId);
          if (idx !== -1) {
            triggerEvent("track_loading", { trackId });
            state.setQueue(state.tracks, idx, "library");
            state.setIsPlaying(true);
            // Simulate async resolution for the queue processing
            setTimeout(resolve, 0);
          } else {
            triggerEvent("track_error", { trackId, error: "Track not found in library" });
            resolve();
          }
        });
      },
      setQueue: async (tracks: Track[], startIndex = 0): Promise<void> => {
        return new Promise((resolve) => {
          useStore.getState().setQueue(tracks, startIndex, "plugin");
          setTimeout(resolve, 0);
        });
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
      setView: (view: any) => useStore.getState().setActiveView(view),
      get activeView() {
        return useStore.getState().activeView;
      },
      registerSidebarComponent: (id: string, config: { name: string; icon: string; viewId: string }) => {
        uiRegistry.sidebarComponents.set(id, config);
        triggerUiUpdate();
      },
      registerTab: (id: string, config: { render: (container: HTMLElement) => void; cleanup?: () => void }) => {
        uiRegistry.views.set(id, config);
        triggerUiUpdate();
      },
      registerOverlay: (id: string, domElement: HTMLElement) => {
        uiRegistry.overlays.set(id, domElement);
        domElement.style.position = "fixed";
        domElement.style.zIndex = "9999";
        domElement.style.pointerEvents = "none"; // Default so it doesn't block UI unless requested
        document.body.appendChild(domElement);
        triggerUiUpdate();
      },
      removeOverlay: (id: string) => {
        const el = uiRegistry.overlays.get(id);
        if (el && el.parentNode) {
          el.parentNode.removeChild(el);
          uiRegistry.overlays.delete(id);
        }
      },
      get registry() {
        return uiRegistry;
      }
    },

    // Storage Sandbox
    storage: {
      set: (pluginId: string, key: string, value: any) => {
        try {
          const prefix = getPluginStoragePrefix(pluginId);
          localStorage.setItem(prefix + key, JSON.stringify(value));
        } catch (e) {
          console.error(`Plugin Storage Error: Could not save key [${key}] for plugin [${pluginId}]`, e);
        }
      },
      get: (pluginId: string, key: string): any => {
        try {
          const prefix = getPluginStoragePrefix(pluginId);
          const val = localStorage.getItem(prefix + key);
          return val ? JSON.parse(val) : null;
        } catch (e) {
          console.error(`Plugin Storage Error: Could not read key [${key}] for plugin [${pluginId}]`, e);
          return null;
        }
      },
      remove: (pluginId: string, key: string) => {
        const prefix = getPluginStoragePrefix(pluginId);
        localStorage.removeItem(prefix + key);
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
