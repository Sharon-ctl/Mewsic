import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { initPluginApi } from '../utils/pluginApi';
import { useStore } from '../store';

let minecraftWs: WebSocket | null = null;
let minecraftReconnectTimer: any = null;

function runMinecraftPlugin() {
  console.log("[Mewsic Built-in] Minecraft Bridge Plugin Loaded!");

  function connect() {
    if (window.Mewsic) {
      window.Mewsic.minecraftConnected = false;
    }
    window.dispatchEvent(new CustomEvent("minecraft-connection-changed", { detail: false }));

    const ws = new WebSocket("ws://127.0.0.1:3012");
    minecraftWs = ws;

    ws.onopen = () => {
      if (window.Mewsic) {
        window.Mewsic.minecraftConnected = true;
        window.Mewsic.ui.addNotification("Connected to Minecraft!", "success", 3000);
      }
      window.dispatchEvent(new CustomEvent("minecraft-connection-changed", { detail: true }));

      if (window.Mewsic && window.Mewsic.player.currentTrack) {
        const track = window.Mewsic.player.currentTrack;
        const sanitized = Object.assign({}, track, {
          title: track.title ? track.title.replace(/\s+/g, "_") : ""
        });
        ws.send(JSON.stringify({
          event: "track_changed",
          data: sanitized
        }));
      }
      // Send complete tracks list on connection
      if (window.Mewsic && window.Mewsic.library && window.Mewsic.library.tracks) {
        const sanitizedList = window.Mewsic.library.tracks.map((t: any) => 
          Object.assign({}, t, {
            title: t.title ? t.title.replace(/\s+/g, "_") : ""
          })
        );
        ws.send(JSON.stringify({
          event: "library_sync",
          data: sanitizedList
        }));
      }
      // Send playlist list on connection
      if (window.Mewsic && window.Mewsic.library && window.Mewsic.library.playlists) {
        const sanitizedPlaylists = window.Mewsic.library.playlists.map((pl: any) => ({
          id: pl.id,
          name: pl.name ? pl.name.replace(/\s+/g, "_") : ""
        }));
        ws.send(JSON.stringify({
          event: "playlists_sync",
          data: sanitizedPlaylists
        }));
      }
      // Send current playlist on connection
      if (window.Mewsic) {
        const currentPlaylist = window.Mewsic.player.currentPlaylistName;
        ws.send(JSON.stringify({
          event: "playlist_changed",
          data: currentPlaylist ? currentPlaylist.replace(/\s+/g, "_") : "library"
        }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (window.Mewsic) {
          if (msg.action === "playNext") window.Mewsic.player.next();
          if (msg.action === "playPrev") window.Mewsic.player.prev();
          if (msg.action === "togglePlay") window.Mewsic.player.togglePlay();
          if (msg.action === "playTrack" && msg.trackId) {
            window.Mewsic.player.playTrack(msg.trackId);
          }
          if (msg.action === "toggleShuffle") {
            window.Mewsic.player.toggleShuffle();
          }
          if (msg.action === "setRepeatMode" && msg.repeatMode) {
            window.Mewsic.player.setRepeatMode(msg.repeatMode);
          }
          if (msg.action === "playPlaylist" && msg.playlistId) {
            window.Mewsic.library.playPlaylist(msg.playlistId);
          }
        }
      } catch (e) {}
    };

    ws.onclose = () => {
      if (window.Mewsic) {
        window.Mewsic.minecraftConnected = false;
      }
      window.dispatchEvent(new CustomEvent("minecraft-connection-changed", { detail: false }));
      // Try to reconnect every 5 seconds if disconnected
      minecraftReconnectTimer = setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      if (window.Mewsic) {
        window.Mewsic.minecraftConnected = false;
      }
      window.dispatchEvent(new CustomEvent("minecraft-connection-changed", { detail: false }));
      ws.close();
    };
  }

  if (window.Mewsic) {
    window.Mewsic.reconnectMinecraft = () => {
      if (minecraftWs) {
        minecraftWs.onclose = null;
        minecraftWs.onerror = null;
        minecraftWs.close();
      }
      if (minecraftReconnectTimer) clearTimeout(minecraftReconnectTimer);
      connect();
    };
  }

  const trackChangedHandler = (track: any) => {
    if (minecraftWs && minecraftWs.readyState === WebSocket.OPEN) {
      const sanitized = track ? Object.assign({}, track, {
        title: track.title ? track.title.replace(/\s+/g, "_") : ""
      }) : null;
      minecraftWs.send(JSON.stringify({ event: "track_changed", data: sanitized }));
    }
  };

  const playbackStateChangedHandler = (isPlaying: any) => {
    if (minecraftWs && minecraftWs.readyState === WebSocket.OPEN) {
      minecraftWs.send(JSON.stringify({ event: "playback_state_changed", data: isPlaying }));
    }
  };

  const timeChangedHandler = (currentTime: any) => {
    if (minecraftWs && minecraftWs.readyState === WebSocket.OPEN) {
      minecraftWs.send(JSON.stringify({ event: "time_changed", data: currentTime }));
    }
  };

  const shuffleChangedHandler = (shuffleEnabled: any) => {
    if (minecraftWs && minecraftWs.readyState === WebSocket.OPEN) {
      minecraftWs.send(JSON.stringify({ event: "shuffle_changed", data: shuffleEnabled }));
    }
  };

  const repeatChangedHandler = (repeatMode: any) => {
    if (minecraftWs && minecraftWs.readyState === WebSocket.OPEN) {
      minecraftWs.send(JSON.stringify({ event: "repeat_changed", data: repeatMode }));
    }
  };

  const playlistChangedHandler = (playlistName: any) => {
    if (minecraftWs && minecraftWs.readyState === WebSocket.OPEN) {
      minecraftWs.send(JSON.stringify({
        event: "playlist_changed",
        data: playlistName ? playlistName.replace(/\s+/g, "_") : "library"
      }));
    }
  };

  if (window.Mewsic) {
    window.Mewsic.events.on('track_changed', trackChangedHandler);
    window.Mewsic.events.on('playback_state_changed', playbackStateChangedHandler);
    window.Mewsic.events.on('time_changed', timeChangedHandler);
    window.Mewsic.events.on('shuffle_changed', shuffleChangedHandler);
    window.Mewsic.events.on('repeat_changed', repeatChangedHandler);
    window.Mewsic.events.on('playlist_changed', playlistChangedHandler);

    window.Mewsic.disconnectMinecraft = () => {
      if (minecraftWs) {
        minecraftWs.onclose = null;
        minecraftWs.onerror = null;
        minecraftWs.close();
        minecraftWs = null;
      }
      if (minecraftReconnectTimer) {
        clearTimeout(minecraftReconnectTimer);
        minecraftReconnectTimer = null;
      }
      if (window.Mewsic) {
        window.Mewsic.minecraftConnected = false;
      }
      window.dispatchEvent(new CustomEvent("minecraft-connection-changed", { detail: false }));

      if (window.Mewsic) {
        window.Mewsic.events.off('track_changed', trackChangedHandler);
        window.Mewsic.events.off('playback_state_changed', playbackStateChangedHandler);
        window.Mewsic.events.off('time_changed', timeChangedHandler);
        window.Mewsic.events.off('shuffle_changed', shuffleChangedHandler);
        window.Mewsic.events.off('repeat_changed', repeatChangedHandler);
        window.Mewsic.events.off('playlist_changed', playlistChangedHandler);
      }
    };
  }

  connect();
}

export interface PluginManifest {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  [key: string]: any;
}

export interface PluginData {
  id: string;
  manifest: PluginManifest;
  js_content: string | null;
  css_content: string | null;
}

export function usePlugins() {
  const [plugins, setPlugins] = useState<PluginData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const minecraftIntegrationEnabled = useStore((s) => s.minecraftIntegrationEnabled);

  useEffect(() => {
    async function loadPlugins() {
      try {
        initPluginApi();
      } catch (e) {
        console.error('Failed to initialize Plugin API:', e);
      }

      // 1. Built-in Plugins
      if (minecraftIntegrationEnabled) {
        if (window.Mewsic && typeof window.Mewsic.disconnectMinecraft !== 'function') {
          try {
            runMinecraftPlugin();
          } catch (e) {
            console.error('Error executing built-in Minecraft plugin:', e);
          }
        }
      } else {
        // Disconnect immediately if disabled
        if (window.Mewsic && typeof window.Mewsic.disconnectMinecraft === 'function') {
          try {
            window.Mewsic.disconnectMinecraft();
          } catch (e) {}
        }
      }

      // 2. External Plugins (Separate try-catch block to prevent breaking built-ins)
      try {
        const loadedPlugins = await invoke<PluginData[]>('get_plugins');
        console.log('[PluginLoader] Received plugins from backend:', loadedPlugins.map(p => p.id));
        setPlugins(loadedPlugins);
        
        const disabledPlugins = JSON.parse(localStorage.getItem('mewsic_disabled_plugins') || '[]');

        // Inject CSS and JS
        for (const plugin of loadedPlugins) {
          if (disabledPlugins.includes(plugin.id)) {
            console.log(`[PluginLoader] Skipping disabled plugin: ${plugin.id}`);
            continue;
          }

          if (plugin.css_content) {
            const styleId = `plugin-style-${plugin.id}`;
            if (!document.getElementById(styleId)) {
              const style = document.createElement('style');
              style.id = styleId;
              style.innerHTML = plugin.css_content;
              document.head.appendChild(style);
            }
          }

          if (plugin.js_content) {
            const scriptId = `plugin-script-${plugin.id}`;
            if (!document.getElementById(scriptId)) {
              console.log(`[PluginLoader] Executing plugin: ${plugin.id}`);
              try {
                // Use Blob URL - works within Tauri CSP and runs in real script scope
                const blob = new Blob([plugin.js_content], { type: 'application/javascript' });
                const url = URL.createObjectURL(blob);
                const script = document.createElement('script');
                script.id = scriptId;
                script.src = url;
                script.onload = () => {
                  URL.revokeObjectURL(url);
                  console.log(`[PluginLoader] Plugin executed successfully: ${plugin.id}`);
                };
                script.onerror = (e) => {
                  URL.revokeObjectURL(url);
                  console.error(`[PluginLoader] Plugin script error (${plugin.id}):`, e);
                };
                document.body.appendChild(script);
              } catch (e) {
                console.error(`[PluginLoader] Error executing plugin ${plugin.id}:`, e);
              }
            }
          }
        }
      } catch (e: any) {
        console.error('Failed to load external plugins:', e);
        setError(e.toString());
      }
    }

    loadPlugins();

    return () => {
      // Cleanup plugins on unmount
      plugins.forEach(plugin => {
        const style = document.getElementById(`plugin-style-${plugin.id}`);
        if (style) style.remove();
        
        const script = document.getElementById(`plugin-script-${plugin.id}`);
        if (script) script.remove();
      });
      
      const builtinScript = document.getElementById('plugin-script-built-in-minecraft');
      if (builtinScript) builtinScript.remove();

      if (window.Mewsic && typeof window.Mewsic.disconnectMinecraft === 'function') {
        try {
          window.Mewsic.disconnectMinecraft();
        } catch (e) {}
      }
    };
  }, [minecraftIntegrationEnabled]); 

  return { plugins, error };
}
