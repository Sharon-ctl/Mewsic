import { useStore } from "../store";
import type { Track, Playlist } from "../types";
import { version } from "../../package.json";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

declare global {
  interface Window {
    Mewsic: any;
  }
}

export function initPluginApi() {
  if (window.Mewsic) return;

  const getPluginStoragePrefix = (pluginId?: string) => `mewsic_plugin_${pluginId || "global"}_`;

  // Separate buckets for system events vs custom plugin-emitted events
  const eventListeners: Record<string, Function[]> = {};
  const customEventListeners: Record<string, Function[]> = {};

  const uiRegistry = {
    sidebarComponents: new Map<string, any>(),
    views: new Map<string, { render: (container: HTMLElement) => void; cleanup?: () => void }>(),
    overlays: new Map<string, HTMLElement>(),
    searchProviders: new Map<string, {
      name: string;
      search: (query: string) => Promise<any>;
      download?: (track: any, musicDir: string, onProgress: (progress: number) => void) => Promise<void>;
    }>(),
  };

  const triggerUiUpdate = () => window.dispatchEvent(new CustomEvent("plugin-ui-updated"));

  const triggerEvent = (event: string, data?: any) => {
    const listeners = eventListeners[event];
    if (!listeners) return;
    for (const cb of listeners) {
      try { cb(data); } catch (e) { console.error(`Plugin event error [${event}]:`, e); }
    }
  };

  // Subscribe to store and fire all events
  useStore.subscribe((state, prev) => {
    if (state.currentTrack?.id !== prev.currentTrack?.id)
      triggerEvent("track_changed", state.currentTrack);
    if (state.isPlaying !== prev.isPlaying)
      triggerEvent("playback_state_changed", state.isPlaying);
    if (state.volume !== prev.volume)
      triggerEvent("volume_changed", state.volume);
    if (state.currentTime !== prev.currentTime)
      triggerEvent("time_changed", state.currentTime);
    if (state.shuffleEnabled !== prev.shuffleEnabled)
      triggerEvent("shuffle_changed", state.shuffleEnabled);
    if (state.repeatMode !== prev.repeatMode)
      triggerEvent("repeat_changed", state.repeatMode);
    if (state.activeView !== prev.activeView)
      triggerEvent("view_changed", state.activeView);
    if (state.queue !== prev.queue)
      triggerEvent("queue_changed", state.queue);
    if (state.theme !== prev.theme)
      triggerEvent("theme_changed", state.theme);
    if (state.accentColor !== prev.accentColor)
      triggerEvent("accent_changed", state.accentColor);
    if (state.tracks !== prev.tracks)
      triggerEvent("library_changed", state.tracks);
    if (state.playlists !== prev.playlists)
      triggerEvent("playlists_changed", state.playlists);
    // DSP events
    if (state.reverbEnabled !== prev.reverbEnabled || state.reverbStrength !== prev.reverbStrength)
      triggerEvent("reverb_changed", { enabled: state.reverbEnabled, strength: state.reverbStrength });
    if (state.bassBoost !== prev.bassBoost)
      triggerEvent("bass_boost_changed", state.bassBoost);
    if (state.volumeBoost !== prev.volumeBoost)
      triggerEvent("volume_boost_changed", state.volumeBoost);
    if (state.playbackSpeed !== prev.playbackSpeed)
      triggerEvent("playback_speed_changed", state.playbackSpeed);
    if (state.eqGains !== prev.eqGains)
      triggerEvent("eq_changed", state.eqGains);
    if (state.queueSourceId !== prev.queueSourceId) {
      const sourceId = state.queueSourceId;
      let playlistName: string | null = null;
      if (sourceId?.startsWith("playlist:")) {
        const pl = state.playlists.find(p => p.id === sourceId.replace("playlist:", ""));
        playlistName = pl?.name ?? null;
      }
      triggerEvent("playlist_changed", playlistName);
    }
  });

  window.Mewsic = {
    version,

    // ── Player ──────────────────────────────────────────────────────────────────

    player: {
      play: () => useStore.getState().setIsPlaying(true),
      pause: () => useStore.getState().setIsPlaying(false),
      togglePlay: () => useStore.getState().setIsPlaying(!useStore.getState().isPlaying),
      next: () => useStore.getState().playNext(),
      prev: () => useStore.getState().playPrev(),
      seek: (time: number) => useStore.getState().requestSeek(time),
      skipForward: (seconds = 5) => {
        const { currentTime, duration, requestSeek } = useStore.getState();
        requestSeek(Math.min(currentTime + seconds, duration));
      },
      skipBackward: (seconds = 5) => {
        const { currentTime, requestSeek } = useStore.getState();
        requestSeek(Math.max(currentTime - seconds, 0));
      },
      setVolume: (volume: number) => useStore.getState().setVolume(Math.max(0, Math.min(1, volume))),
      toggleMute: () => useStore.getState().toggleMute(),
      fadeVolume: (targetVolume: number, duration: number) => {
        const state = useStore.getState();
        const startVolume = state.volume;
        const startTime = performance.now();
        const ease = (t: number) => t * (2 - t);
        const animate = (now: number) => {
          const progress = Math.min((now - startTime) / duration, 1);
          state.setVolume(startVolume + (targetVolume - startVolume) * ease(progress));
          if (progress < 1) requestAnimationFrame(animate);
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
          queueIndex: s.queueIndex,
          currentTime: s.currentTime,
          duration: s.duration,
          shuffleEnabled: s.shuffleEnabled,
          repeatMode: s.repeatMode,
          activeView: s.activeView,
          queueSourceId: s.queueSourceId,
        };
      },

      get currentTrack(): Track | null { return useStore.getState().currentTrack; },
      get isPlaying(): boolean { return useStore.getState().isPlaying; },
      get volume(): number { return useStore.getState().volume; },
      get queue(): Track[] { return useStore.getState().queue; },
      get queueIndex(): number { return useStore.getState().queueIndex; },
      get currentTime(): number { return useStore.getState().currentTime; },
      get duration(): number { return useStore.getState().duration; },
      get shuffleEnabled(): boolean { return useStore.getState().shuffleEnabled; },
      get repeatMode(): "off" | "one" | "all" { return useStore.getState().repeatMode; },
      get currentPlaylistName(): string | null {
        const state = useStore.getState();
        const sourceId = state.queueSourceId;
        if (sourceId?.startsWith("playlist:")) {
          return state.playlists.find(p => p.id === sourceId.replace("playlist:", ""))?.name ?? null;
        }
        return null;
      },

      playTrack: (trackId: string): Promise<void> => new Promise(resolve => {
        const state = useStore.getState();
        const idx = state.tracks.findIndex(t => t.id === trackId);
        if (idx !== -1) {
          triggerEvent("track_loading", { trackId });
          state.setQueue(state.tracks, idx, "library");
          state.setIsPlaying(true);
        } else {
          triggerEvent("track_error", { trackId, error: "Track not found in library" });
        }
        setTimeout(resolve, 0);
      }),

      playVirtualTrack: (track: Track): Promise<void> => new Promise(resolve => {
        const state = useStore.getState();
        const virtualTrack = { ...track, provider: track.provider || "virtual" };
        triggerEvent("track_loading", { trackId: virtualTrack.id });
        state.setQueue([virtualTrack], 0, "plugin:virtual");
        state.setIsPlaying(true);
        setTimeout(resolve, 0);
      }),

      setQueue: (tracks: Track[], startIndex = 0): Promise<void> => new Promise(resolve => {
        useStore.getState().setQueue(tracks, startIndex, "plugin");
        setTimeout(resolve, 0);
      }),

      addToQueue: (track: Track) => {
        const state = useStore.getState();
        useStore.setState({
          queue: [...state.queue, track],
          originalQueue: [...state.originalQueue, track],
        });
      },

      removeFromQueue: (trackId: string) => {
        const state = useStore.getState();
        const idx = state.queue.findIndex(t => t.id === trackId);
        if (idx === -1) return;
        const newQueue = state.queue.filter(t => t.id !== trackId);
        const newOriginal = state.originalQueue.filter(t => t.id !== trackId);
        let newIndex = state.queueIndex;
        if (idx < state.queueIndex) newIndex--;
        useStore.setState({ queue: newQueue, originalQueue: newOriginal, queueIndex: newIndex });
      },

      clearQueue: () => {
        useStore.setState({ queue: [], originalQueue: [], currentTrack: null, isPlaying: false, queueIndex: -1 });
      },

      _resolvers: [] as ((url: string) => Promise<{ url: string; title?: string; artist?: string; duration?: number; coverArt?: string } | null>)[],
      registerResolver: (resolver: (url: string) => Promise<{ url: string; title?: string; artist?: string; duration?: number; coverArt?: string } | null>) => {
        if (!window.Mewsic.player._resolvers) window.Mewsic.player._resolvers = [];
        window.Mewsic.player._resolvers.push(resolver);
      },
    },

    // ── Library ─────────────────────────────────────────────────────────────────

    library: {
      get tracks(): Track[] { return useStore.getState().tracks; },
      get virtualTracks(): Track[] { return useStore.getState().virtualTracks || []; },
      get playlists(): Playlist[] { return useStore.getState().playlists; },
      get musicDir(): string { return useStore.getState().musicDir; },
      get isScanning(): boolean { return useStore.getState().isScanning; },

      getTrack: (trackId: string): Track | null =>
        useStore.getState().tracks.find(t => t.id === trackId) ?? null,

      getPlaylist: (playlistId: string): Playlist | null =>
        useStore.getState().playlists.find(p => p.id === playlistId) ?? null,

      addTracks: (tracks: Track[]) => useStore.getState().addTracks(tracks),
      addVirtualTrack: (track: Track) => useStore.getState().addVirtualTrack(track),
      removeVirtualTrack: (trackId: string) => useStore.getState().removeVirtualTrack(trackId),
      updateTrack: (track: Track) => useStore.getState().updateTrack(track),

      addPlaylist: (playlist: any) => useStore.getState().addPlaylist(playlist),
      updatePlaylist: (playlist: Playlist) => useStore.getState().updatePlaylist(playlist),
      removePlaylist: (id: string) => useStore.getState().removePlaylist(id),

      addTrackToPlaylist: (trackId: string, playlistId: string) => {
        const state = useStore.getState();
        const playlist = state.playlists.find(p => p.id === playlistId);
        if (!playlist) return;
        if (playlist.trackIds.includes(trackId)) return;
        state.updatePlaylist({ ...playlist, trackIds: [...playlist.trackIds, trackId] });
      },

      removeTrackFromPlaylist: (trackId: string, playlistId: string) => {
        const state = useStore.getState();
        const playlist = state.playlists.find(p => p.id === playlistId);
        if (!playlist) return;
        state.updatePlaylist({ ...playlist, trackIds: playlist.trackIds.filter(id => id !== trackId) });
      },

      getPlaylistTracks: (playlistId: string): Track[] => {
        const state = useStore.getState();
        const playlist = state.playlists.find(p => p.id === playlistId);
        if (!playlist) return [];
        return playlist.trackIds
          .map(id => state.tracks.find(t => t.id === id))
          .filter((t): t is Track => !!t);
      },

      playPlaylist: (playlistId: string, startIndex = 0) => {
        const state = useStore.getState();
        const playlist = state.playlists.find(p => p.id === playlistId);
        if (!playlist || playlist.trackIds.length === 0) return;
        const playlistTracks = playlist.trackIds
          .map(id => state.tracks.find(t => t.id === id))
          .filter((t): t is Track => !!t);
        if (playlistTracks.length > 0) {
          state.setQueue(playlistTracks, Math.min(startIndex, playlistTracks.length - 1), `playlist:${playlistId}`);
          state.setIsPlaying(true);
        }
      },

      search: (query: string): Track[] => {
        const q = query.toLowerCase();
        return useStore.getState().tracks.filter(t =>
          t.title?.toLowerCase().includes(q) ||
          t.artist?.toLowerCase().includes(q) ||
          t.album?.toLowerCase().includes(q)
        );
      },

      downloadTrack: async (options: {
        title: string;
        artist: string;
        album: string;
        coverArt: string;
        url: string;
        onProgress?: (progress: number) => void;
      }): Promise<void> => {
        const store = useStore.getState();
        const notifId = store.addNotification("Downloading...", "info", 0, true, options.title);
        let unlisten: (() => void) | undefined;
        try {
          if (options.onProgress) {
            unlisten = await listen("download-progress", (event: any) => {
              const { id, progress } = event.payload;
              if (id === notifId) options.onProgress?.(progress);
            });
          }
          await invoke("download_track", {
            musicDir: store.musicDir,
            title: options.title,
            artist: options.artist,
            album: options.album,
            coverArt: options.coverArt,
            downloadId: notifId,
            url: options.url,
            format: "mp3",
            ipVersion: "ipv4",
          });
          useStore.getState().updateNotification(notifId, { message: "Download complete!", type: "success", loading: false });
          setTimeout(() => useStore.getState().removeNotification(notifId), 3000);
        } catch (err: any) {
          useStore.getState().updateNotification(notifId, { message: `Download failed: ${err.message || err}`, type: "error", loading: false });
          setTimeout(() => useStore.getState().removeNotification(notifId), 5000);
          throw err;
        } finally {
          unlisten?.();
        }
      },
    },

    // ── Audio DSP ────────────────────────────────────────────────────────────────

    audio: {
      get reverbEnabled(): boolean { return useStore.getState().reverbEnabled; },
      get reverbStrength(): number { return useStore.getState().reverbStrength; },
      get bassBoost(): number { return useStore.getState().bassBoost; },
      get volumeBoost(): number { return useStore.getState().volumeBoost; },
      get playbackSpeed(): number { return useStore.getState().playbackSpeed; },
      get eqGains(): number[] { return [...useStore.getState().eqGains]; },
      get activePresetId(): string | null { return useStore.getState().activePresetId; },
      get presets() { return useStore.getState().audioPresets; },

      setReverb: (enabled: boolean, strength?: number) => {
        useStore.getState().setReverbEnabled(enabled);
        if (strength !== undefined) useStore.getState().setReverbStrength(Math.max(0, Math.min(1, strength)));
      },
      setBassBoost: (db: number) => useStore.getState().setBassBoost(db),
      setVolumeBoost: (multiplier: number) => useStore.getState().setVolumeBoost(Math.max(0.5, Math.min(3, multiplier))),
      setPlaybackSpeed: (speed: number) => useStore.getState().setPlaybackSpeed(speed),
      setEqGain: (band: number, gain: number) => useStore.getState().setEqGain(band, gain),
      setEqGains: (gains: number[]) => {
        gains.forEach((gain, i) => useStore.getState().setEqGain(i, gain));
      },
      resetEq: () => useStore.getState().resetEq(),
      resetAll: () => useStore.getState().resetAudioEffects(),
      applyPreset: (presetId: string) => useStore.getState().applyPreset(presetId),
      savePreset: (name: string) => useStore.getState().savePreset(name),
      deletePreset: (presetId: string) => useStore.getState().deletePreset(presetId),

      getState: () => {
        const s = useStore.getState();
        return {
          reverbEnabled: s.reverbEnabled,
          reverbStrength: s.reverbStrength,
          bassBoost: s.bassBoost,
          volumeBoost: s.volumeBoost,
          playbackSpeed: s.playbackSpeed,
          eqGains: [...s.eqGains],
          activePresetId: s.activePresetId,
        };
      },
    },

    // ── UI ──────────────────────────────────────────────────────────────────────

    ui: {
      get activeView() { return useStore.getState().activeView; },
      get theme(): "dark" | "light" { return useStore.getState().theme; },
      get accentColor(): string { return useStore.getState().accentColor; },
      get guiScale(): number { return useStore.getState().guiScale; },
      get isFullscreen(): boolean { return useStore.getState().isFullscreen; },

      addNotification: (message: string, type: "info" | "success" | "error" = "info", duration = 5000, title?: string): string =>
        useStore.getState().addNotification(message, type, duration, false, title),
      dismissNotification: (id: string) => useStore.getState().removeNotification(id),

      setTheme: (theme: "dark" | "light") => useStore.getState().setTheme(theme),
      setAccentColor: (color: string) => useStore.getState().setAccentColor(color as any),
      setGuiScale: (scale: number) => useStore.getState().setGuiScale(Math.max(0.75, Math.min(1.5, scale))),
      setView: (view: any) => useStore.getState().setActiveView(view),
      openLibrary: () => useStore.getState().setActiveView("library"),
      openPlaylist: (playlistId: string) => useStore.getState().setActivePlaylist(playlistId),
      openSettings: () => useStore.getState().setActiveView("settings"),
      openPlayer: () => useStore.getState().setActiveView("player"),

      setSearchQuery: (query: string) => useStore.getState().setSearchQuery(query),

      registerSidebarComponent: (id: string, config: { name: string; icon: string; viewId: string }) => {
        uiRegistry.sidebarComponents.set(id, config);
        triggerUiUpdate();
      },
      unregisterSidebarComponent: (id: string) => {
        uiRegistry.sidebarComponents.delete(id);
        triggerUiUpdate();
      },
      registerTab: (id: string, config: { render: (container: HTMLElement) => void; cleanup?: () => void }) => {
        uiRegistry.views.set(id, config);
        triggerUiUpdate();
      },
      unregisterTab: (id: string) => {
        const view = uiRegistry.views.get(id);
        view?.cleanup?.();
        uiRegistry.views.delete(id);
        triggerUiUpdate();
      },
      registerOverlay: (id: string, domElement: HTMLElement) => {
        uiRegistry.overlays.set(id, domElement);
        domElement.style.position = "fixed";
        domElement.style.zIndex = "9999";
        domElement.style.pointerEvents = "none";
        document.body.appendChild(domElement);
        triggerUiUpdate();
      },
      removeOverlay: (id: string) => {
        const el = uiRegistry.overlays.get(id);
        if (el?.parentNode) {
          el.parentNode.removeChild(el);
          uiRegistry.overlays.delete(id);
        }
      },
      registerSearchProvider: (id: string, config: {
        name: string;
        search: (query: string) => Promise<any>;
        download?: (track: any, musicDir: string, onProgress: (progress: number) => void) => Promise<void>;
      }) => {
        uiRegistry.searchProviders.set(id, config);
        triggerUiUpdate();
      },
      unregisterSearchProvider: (id: string) => {
        uiRegistry.searchProviders.delete(id);
        triggerUiUpdate();
      },

      injectCSS: (id: string, css: string) => {
        const existing = document.getElementById(`plugin-css-${id}`);
        if (existing) { existing.innerHTML = css; return; }
        const style = document.createElement("style");
        style.id = `plugin-css-${id}`;
        style.innerHTML = css;
        document.head.appendChild(style);
      },
      removeCSS: (id: string) => {
        document.getElementById(`plugin-css-${id}`)?.remove();
      },

      get registry() { return uiRegistry; },
    },

    // ── Settings ─────────────────────────────────────────────────────────────────

    settings: {
      get theme(): "dark" | "light" { return useStore.getState().theme; },
      get accentColor(): string { return useStore.getState().accentColor; },
      get guiScale(): number { return useStore.getState().guiScale; },
      get discordEnabled(): boolean { return useStore.getState().discordEnabled; },
      get systemNotifications(): boolean { return useStore.getState().systemNotifications; },
      get trayEnabled(): boolean { return useStore.getState().trayEnabled; },
      get smoothScrollEnabled(): boolean { return useStore.getState().smoothScrollEnabled ?? true; },
      get repeatMode(): "off" | "one" | "all" { return useStore.getState().repeatMode; },
      get shuffleEnabled(): boolean { return useStore.getState().shuffleEnabled; },
      get libraryViewMode(): "grid" | "list" { return useStore.getState().libraryViewMode; },
      get homeViewMode(): "grid" | "list" { return useStore.getState().homeViewMode; },
      get playlistViewMode(): "grid" | "list" { return useStore.getState().playlistViewMode; },
      get shortcuts() { return { ...useStore.getState().shortcuts }; },

      setTheme: (theme: "dark" | "light") => useStore.getState().setTheme(theme),
      setAccentColor: (color: string) => useStore.getState().setAccentColor(color as any),
      setGuiScale: (scale: number) => useStore.getState().setGuiScale(Math.max(0.75, Math.min(1.5, scale))),
      setDiscordEnabled: (v: boolean) => useStore.getState().setDiscordEnabled(v),
      setSystemNotifications: (v: boolean) => useStore.getState().setSystemNotifications(v),
      setTrayEnabled: (v: boolean) => {
        useStore.getState().setTrayEnabled(v);
        invoke("set_tray_enabled", { enabled: v }).catch(() => {});
      },
      setSmoothScrollEnabled: (v: boolean) => useStore.getState().setSmoothScrollEnabled(v),
      setRepeatMode: (mode: "off" | "one" | "all") => useStore.getState().setRepeatMode(mode),
      setShuffle: (v: boolean) => {
        if (v !== useStore.getState().shuffleEnabled) useStore.getState().toggleShuffle();
      },
      setLibraryViewMode: (mode: "grid" | "list") => useStore.getState().setLibraryViewMode(mode),
      setHomeViewMode: (mode: "grid" | "list") => useStore.getState().setHomeViewMode(mode),
      setPlaylistViewMode: (mode: "grid" | "list") => useStore.getState().setPlaylistViewMode(mode),

      // Remap a single keyboard shortcut for a built-in action
      setShortcut: (
        action: string,
        key: string,
        options?: { ctrl?: boolean; shift?: boolean; alt?: boolean }
      ) => {
        useStore.getState().setShortcut(
          action as any,
          key,
          options?.ctrl ?? false,
          options?.shift ?? false,
          options?.alt ?? false
        );
      },
      resetShortcuts: () => useStore.getState().resetShortcuts(),

      get: () => {
        const s = useStore.getState();
        return {
          theme: s.theme,
          accentColor: s.accentColor,
          guiScale: s.guiScale,
          discordEnabled: s.discordEnabled,
          systemNotifications: s.systemNotifications,
          trayEnabled: s.trayEnabled,
          smoothScrollEnabled: s.smoothScrollEnabled,
          repeatMode: s.repeatMode,
          shuffleEnabled: s.shuffleEnabled,
          libraryViewMode: s.libraryViewMode,
          homeViewMode: s.homeViewMode,
          playlistViewMode: s.playlistViewMode,
          shortcuts: { ...s.shortcuts },
        };
      },
    },

    // ── Storage ──────────────────────────────────────────────────────────────────

    storage: {
      set: (pluginId: string, key: string, value: any) => {
        try {
          localStorage.setItem(getPluginStoragePrefix(pluginId) + key, JSON.stringify(value));
        } catch (e) {
          console.error(`Plugin storage write failed [${pluginId}/${key}]:`, e);
        }
      },
      get: (pluginId: string, key: string): any => {
        try {
          const val = localStorage.getItem(getPluginStoragePrefix(pluginId) + key);
          return val ? JSON.parse(val) : null;
        } catch (e) {
          console.error(`Plugin storage read failed [${pluginId}/${key}]:`, e);
          return null;
        }
      },
      remove: (pluginId: string, key: string) => {
        localStorage.removeItem(getPluginStoragePrefix(pluginId) + key);
      },
      // Return all keys belonging to a plugin
      keys: (pluginId: string): string[] => {
        const prefix = getPluginStoragePrefix(pluginId);
        return Object.keys(localStorage)
          .filter(k => k.startsWith(prefix))
          .map(k => k.slice(prefix.length));
      },
      // Wipe all keys for a plugin
      clear: (pluginId: string) => {
        const prefix = getPluginStoragePrefix(pluginId);
        Object.keys(localStorage)
          .filter(k => k.startsWith(prefix))
          .forEach(k => localStorage.removeItem(k));
      },
    },

    // ── Events ───────────────────────────────────────────────────────────────────

    events: {
      on: (event: string, callback: Function) => {
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(callback);
      },
      off: (event: string, callback: Function) => {
        if (!eventListeners[event]) return;
        eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
      },
      // Fire callback once and auto-unsubscribe
      once: (event: string, callback: Function) => {
        const wrapper = (data: any) => {
          callback(data);
          if (eventListeners[event]) {
            eventListeners[event] = eventListeners[event].filter(cb => cb !== wrapper);
          }
        };
        if (!eventListeners[event]) eventListeners[event] = [];
        eventListeners[event].push(wrapper);
      },
      // Plugins can emit custom namespaced events other plugins can listen to
      emit: (event: string, data?: any) => {
        const listeners = customEventListeners[event];
        if (!listeners) return;
        for (const cb of listeners) {
          try { cb(data); } catch (e) { console.error(`Custom event error [${event}]:`, e); }
        }
      },
      onCustom: (event: string, callback: Function) => {
        if (!customEventListeners[event]) customEventListeners[event] = [];
        customEventListeners[event].push(callback);
      },
      offCustom: (event: string, callback: Function) => {
        if (!customEventListeners[event]) return;
        customEventListeners[event] = customEventListeners[event].filter(cb => cb !== callback);
      },
    },
  };
}
