import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { initPluginApi } from '../utils/pluginApi';
import { useStore } from '../store';

const MINECRAFT_PLUGIN_CODE = `
  console.log("[Mewsic Built-in] Minecraft Bridge Plugin Loaded!");
  let ws = null;
  let reconnectTimer = null;

  function connect() {
    ws = new WebSocket("ws://127.0.0.1:3012");

    ws.onopen = () => {
      window.Mewsic.ui.addNotification("Connected to Minecraft!", "success", 3000);
      if (window.Mewsic.player.currentTrack) {
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
      if (window.Mewsic.library && window.Mewsic.library.tracks) {
        const sanitizedList = window.Mewsic.library.tracks.map((t) => 
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
      if (window.Mewsic.library && window.Mewsic.library.playlists) {
        const sanitizedPlaylists = window.Mewsic.library.playlists.map((pl) => ({
          id: pl.id,
          name: pl.name ? pl.name.replace(/\s+/g, "_") : ""
        }));
        ws.send(JSON.stringify({
          event: "playlists_sync",
          data: sanitizedPlaylists
        }));
      }
      // Send current playlist on connection
      const currentPlaylist = window.Mewsic.player.currentPlaylistName;
      ws.send(JSON.stringify({
        event: "playlist_changed",
        data: currentPlaylist ? currentPlaylist.replace(/\s+/g, "_") : "library"
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
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
      } catch (e) {}
    };

    ws.onclose = () => {
      // Try to reconnect every 5 seconds if disconnected
      reconnectTimer = setTimeout(connect, 5000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  connect();

  window.Mewsic.events.on('track_changed', (track) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      const sanitized = track ? Object.assign({}, track, {
        title: track.title ? track.title.replace(/\s+/g, "_") : ""
      }) : null;
      ws.send(JSON.stringify({ event: "track_changed", data: sanitized }));
    }
  });

  window.Mewsic.events.on('playback_state_changed', (isPlaying) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "playback_state_changed", data: isPlaying }));
    }
  });

  window.Mewsic.events.on('time_changed', (currentTime) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "time_changed", data: currentTime }));
    }
  });

  window.Mewsic.events.on('shuffle_changed', (shuffleEnabled) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "shuffle_changed", data: shuffleEnabled }));
    }
  });

  window.Mewsic.events.on('repeat_changed', (repeatMode) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ event: "repeat_changed", data: repeatMode }));
    }
  });

  window.Mewsic.events.on('playlist_changed', (playlistName) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        event: "playlist_changed",
        data: playlistName ? playlistName.replace(/\s+/g, "_") : "library"
      }));
    }
  });
`;

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
        // Ensure the Mewsic plugin API is initialized before any plugins run
        initPluginApi();

        const loadedPlugins = await invoke<PluginData[]>('get_plugins');
        setPlugins(loadedPlugins);
        
        // Inject CSS and JS
        loadedPlugins.forEach(plugin => {
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
              const script = document.createElement('script');
              script.id = scriptId;
              script.type = 'text/javascript';
              script.innerHTML = `
                (function() {
                  try {
                    ${plugin.js_content}
                  } catch (e) {
                    console.error('Error executing plugin ${plugin.id}:', e);
                  }
                })();
              `;
              document.body.appendChild(script);
            }
          }
        });

        // Built-in Plugins
        if (minecraftIntegrationEnabled) {
          const scriptId = 'plugin-script-built-in-minecraft';
          if (!document.getElementById(scriptId)) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.type = 'text/javascript';
            script.innerHTML = `
              (function() {
                try {
                  ${MINECRAFT_PLUGIN_CODE}
                } catch (e) {
                  console.error('Error executing built-in Minecraft plugin:', e);
                }
              })();
            `;
            document.body.appendChild(script);
          }
        }

      } catch (e: any) {
        console.error('Failed to load plugins:', e);
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
    };
  }, [minecraftIntegrationEnabled]); 

  return { plugins, error };
}
