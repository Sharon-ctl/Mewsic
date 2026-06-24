# Mewsic Plugin API

Plugins are plain JavaScript files that run inside Mewsic's webview. They have full access to `window.Mewsic` once the app has loaded.

---

## Plugin Format

```
my-plugin.mewsic/
├── manifest.json   required
├── plugin.js       required
└── styles.css      optional
```

### manifest.json

All fields except `id`, `name`, and `version` are optional.

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A short description shown in the Plugins tab.",
  "author": "your-name",
  "homepage": "https://example.com",
  "permissions": ["library", "audio", "settings"]
}
```

| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier. Used for storage namespacing and sidebar IDs. Use kebab-case. |
| `name` | `string` | Display name shown in the Plugins view. |
| `version` | `string` | Semver string, e.g. `"1.0.0"`. |
| `description` | `string` | Short description. |
| `author` | `string` | Your name or handle. |
| `homepage` | `string` | URL to your plugin's page or repo. |
| `permissions` | `string[]` | Informational only — tells users what the plugin touches. Not enforced. |

### plugin.js

Plain JavaScript — no bundler required. Wrap everything in an IIFE to avoid polluting globals.

```javascript
(() => {
  const M = window.Mewsic;
  // your plugin code here
})();
```

### styles.css

Any valid CSS. Gets injected into the app's `<head>` automatically when the plugin loads. You have access to all of Mewsic's CSS custom properties.

```css
/* Available CSS variables (sample) */
/*
  --accent            primary accent color
  --accent-dim        darker shade of accent
  --accent-bright     lighter shade of accent
  --accent-muted      accent at low opacity (backgrounds)
  --accent-glow       accent for glow/shadow effects
  --text-accent       accent-colored text
  --surface-base      app background
  --surface-raised    card background
  --surface-overlay   elevated panel background
  --surface-glass     translucent glass background
  --text-primary      main text
  --text-secondary    secondary text
  --text-muted        muted/hint text
  --border-subtle     faint divider
  --border-glass      glass border
*/

/* Example: add a glow to all playing cards */
.music-card.playing {
  box-shadow: 0 0 20px var(--accent-glow);
}

/* Example: custom scrollbar color */
::-webkit-scrollbar-thumb {
  background: var(--accent-muted);
}
```

Styles are removed when the plugin is uninstalled. Use specific selectors to avoid unintentionally overriding core UI.

---

## Installation

### Users — double-click install

Zip up the plugin folder and rename it to `pluginname.mewsic`. Double-clicking the file opens Mewsic and installs it automatically.

```bash
cd my-plugin.mewsic/
zip -r ../my-plugin.mewsic manifest.json plugin.js styles.css
```

### Users — manual install

Copy the `.mewsic` folder to:

| Platform | Path |
| :--- | :--- |
| Linux | `~/.config/mewsic/plugins/` |
| macOS | `~/Library/Application Support/dev.xeoniii.mewsic/plugins/` |
| Windows | `%APPDATA%\dev.xeoniii.mewsic\plugins\` |

### Developers — live editing

Drop the `.mewsic` folder in the plugin directory while Mewsic is running. Edit `plugin.js` and `styles.css` freely — changes apply on the next reload (`Ctrl+Shift+R`). No build step needed.

```bash
mkdir -p ~/.config/mewsic/plugins/my-plugin.mewsic
# edit files, reload Mewsic to see changes
```

---

## API Namespaces

| Namespace | Purpose |
| :--- | :--- |
| `Mewsic.player` | Playback control, queue, stream resolvers |
| `Mewsic.library` | Track and playlist CRUD |
| `Mewsic.audio` | DSP — EQ, reverb, speed, presets |
| `Mewsic.ui` | Views, overlays, sidebar tabs, search providers, CSS |
| `Mewsic.settings` | App settings — read and write |
| `Mewsic.storage` | Per-plugin key-value persistence |
| `Mewsic.events` | System events and cross-plugin messaging |

---

## `Mewsic.player`

### Getters

| Property | Type | Description |
| :--- | :--- | :--- |
| `currentTrack` | `Track \| null` | Active track |
| `isPlaying` | `boolean` | Playback state |
| `volume` | `number` | Volume 0–1 |
| `queue` | `Track[]` | Current queue |
| `queueIndex` | `number` | Position in queue |
| `currentTime` | `number` | Playhead in seconds |
| `duration` | `number` | Track length in seconds |
| `shuffleEnabled` | `boolean` | Shuffle state |
| `repeatMode` | `"off" \| "one" \| "all"` | Repeat mode |
| `currentPlaylistName` | `string \| null` | Active playlist name |

### Playback control

```javascript
Mewsic.player.play()
Mewsic.player.pause()
Mewsic.player.togglePlay()
Mewsic.player.next()
Mewsic.player.prev()
Mewsic.player.seek(30)                  // jump to 30 seconds
Mewsic.player.skipForward(10)           // skip ahead 10s
Mewsic.player.skipBackward(10)
Mewsic.player.setVolume(0.8)            // 0.0 – 1.0
Mewsic.player.toggleMute()
Mewsic.player.fadeVolume(0.0, 2000)     // fade to 0 over 2 seconds
Mewsic.player.setPlaybackRate(1.25)     // 0.5 – 2.0
Mewsic.player.toggleShuffle()
Mewsic.player.setRepeatMode("all")
Mewsic.player.getState()               // full state snapshot
```

### Playing tracks

```javascript
// Play a local library track
await Mewsic.player.playTrack("track-id");

// Play a virtual/remote track directly
await Mewsic.player.playVirtualTrack({
  id: "my-plugin:abc123",
  title: "Track Title",
  artist: "Artist Name",
  album: "Album Name",
  duration: 200,
  filePath: "https://example.com/audio.mp3",
  isVirtual: true,
  provider: "my-plugin",
  coverArt: "https://example.com/cover.jpg"
});
```

### Queue

```javascript
await Mewsic.player.setQueue(tracks, startIndex);
Mewsic.player.addToQueue(track);
Mewsic.player.removeFromQueue("track-id");
Mewsic.player.clearQueue();
```

### Stream resolvers

Intercept remote URLs before the audio engine loads them. Return a direct audio URL or `null` to pass through.

```javascript
Mewsic.player.registerResolver(async (url) => {
  if (!url.startsWith("myscheme://")) return null;

  const directUrl = await resolveMyScheme(url);
  return {
    url: directUrl,       // required
    title: "Override",    // optional metadata overrides
    artist: "Someone",
    duration: 180,
    coverArt: "https://example.com/art.jpg"
  };
});
```

---

## `Mewsic.library`

### Getters

| Property | Type | Description |
| :--- | :--- | :--- |
| `tracks` | `Track[]` | All tracks (local + virtual) |
| `virtualTracks` | `Track[]` | Plugin-provided tracks only |
| `playlists` | `Playlist[]` | All playlists |
| `musicDir` | `string` | User's music folder path |
| `isScanning` | `boolean` | Scan in progress |

### Tracks

```javascript
Mewsic.library.getTrack("track-id");
Mewsic.library.search("query");              // searches title, artist, album
Mewsic.library.addTracks([...tracks]);
Mewsic.library.updateTrack(track);
Mewsic.library.addVirtualTrack(track);       // shows Virtual badge in UI
Mewsic.library.removeVirtualTrack("id");
Mewsic.library.purgeVirtualTracks();         // deletes all virtual tracks from the library
```

### Playlists

```javascript
Mewsic.library.getPlaylist("id");
Mewsic.library.getPlaylistTracks("id");
Mewsic.library.addPlaylist(playlist);
Mewsic.library.updatePlaylist(playlist);
Mewsic.library.removePlaylist("id");
Mewsic.library.addTrackToPlaylist("track-id", "playlist-id");
Mewsic.library.removeTrackFromPlaylist("track-id", "playlist-id");
Mewsic.library.playPlaylist("id", startIndex);
```

### Download

```javascript
await Mewsic.library.downloadTrack({
  title: "Track Title",
  artist: "Artist",
  url: "https://example.com/source",
  onProgress: (pct) => console.log(`${pct}%`)
});
```

---

## `Mewsic.audio`

### Getters

| Property | Type |
| :--- | :--- |
| `reverbEnabled` | `boolean` |
| `reverbStrength` | `number` (0–1) |
| `bassBoost` | `number` (0–20 dB) |
| `volumeBoost` | `number` (1.0–2.0) |
| `playbackSpeed` | `number` (0.5–2.0) |
| `eqGains` | `number[]` (10 bands) |
| `activePresetId` | `string \| null` |
| `presets` | `AudioPreset[]` |

### Methods

```javascript
Mewsic.audio.setReverb(true, 0.4)         // enable with 40% wet
Mewsic.audio.setBassBoost(8)              // +8 dB
Mewsic.audio.setVolumeBoost(1.5)
Mewsic.audio.setPlaybackSpeed(1.25)
Mewsic.audio.setEqGain(0, 6)             // band 0 (32Hz) +6 dB
Mewsic.audio.setEqGains([6,4,2,0,0,0,-2,-2,-4,-4])
Mewsic.audio.resetEq()
Mewsic.audio.resetAll()
Mewsic.audio.applyPreset("preset-id")
Mewsic.audio.savePreset("My Preset")
Mewsic.audio.deletePreset("preset-id")
Mewsic.audio.getState()
```

> In Low-End Mode, reverb is bypassed by the engine automatically. All setters still work and are restored when Low-End Mode is turned off.

---

## `Mewsic.ui`

### Navigation

```javascript
Mewsic.ui.setView("library")
Mewsic.ui.openLibrary()
Mewsic.ui.openPlayer()
Mewsic.ui.openSettings()
Mewsic.ui.openPlaylist("id")
Mewsic.ui.setSearchQuery("query")
```

### Appearance

```javascript
Mewsic.ui.setTheme("dark" | "light")
Mewsic.ui.setAccentColor("violet")
Mewsic.ui.setGuiScale(1.0)            // 0.75 – 1.5
```

### Toast notifications

```javascript
const id = Mewsic.ui.addNotification("Done!", "success", 3000, "My Plugin");
Mewsic.ui.dismissNotification(id);
// types: "info" | "success" | "error"
// duration 0 = stays until dismissed
```

### Sidebar icon + custom view

```javascript
Mewsic.ui.registerSidebarComponent("my-plugin", {
  name: "My Plugin",
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
  </svg>`,
  viewId: "plugin:my-plugin"
});

Mewsic.ui.registerTab("plugin:my-plugin", {
  render: (container) => {
    container.innerHTML = `
      <div style="padding:24px; color:var(--text-primary);">
        <h1 style="font-weight:800;">My Plugin</h1>
        <p style="color:var(--text-muted); margin-top:8px;">Plugin view content goes here.</p>
      </div>
    `;
  },
  cleanup: () => { /* teardown logic */ }
});

// Remove when done
Mewsic.ui.unregisterSidebarComponent("my-plugin");
Mewsic.ui.unregisterTab("plugin:my-plugin");
```

### Overlay

```javascript
const el = document.createElement("div");
el.textContent = "♫";
el.style.cssText = "position:fixed;bottom:120px;right:24px;color:var(--accent);font-size:2rem;pointer-events:none;";

Mewsic.ui.registerOverlay("my-overlay", el);
Mewsic.ui.removeOverlay("my-overlay");
```

### Search provider

```javascript
Mewsic.ui.registerSearchProvider("my-source", {
  name: "My Source",
  search: async (query) => {
    const results = await fetch(`https://api.example.com/search?q=${encodeURIComponent(query)}`)
      .then(r => r.json());
    return results.map(item => ({
      id: item.id,
      title: item.title,
      artist: item.artist,
      album: item.album,
      duration: item.duration,
      coverArt: item.thumbnail,
      url: item.streamUrl
    }));
  },
  download: async (track, musicDir, onProgress) => {
    await Mewsic.library.downloadTrack({ ...track, onProgress });
  }
});

Mewsic.ui.unregisterSearchProvider("my-source");
```

### CSS injection

```javascript
// Complements styles.css for dynamic/conditional styling
Mewsic.ui.injectCSS("my-plugin-dynamic", `
  .sidebar { border-right: 2px solid var(--accent); }
`);
Mewsic.ui.removeCSS("my-plugin-dynamic");
```

---

## `Mewsic.settings`

### Read

```javascript
Mewsic.settings.theme               // "dark" | "light"
Mewsic.settings.accentColor
Mewsic.settings.guiScale            // 0.75 – 1.5
Mewsic.settings.discordEnabled
Mewsic.settings.systemNotifications
Mewsic.settings.trayEnabled
Mewsic.settings.smoothScrollEnabled
Mewsic.settings.repeatMode          // "off" | "one" | "all"
Mewsic.settings.shuffleEnabled
Mewsic.settings.libraryViewMode     // "grid" | "list"
Mewsic.settings.homeViewMode
Mewsic.settings.playlistViewMode
Mewsic.settings.shortcuts           // ShortcutMap copy

Mewsic.settings.get()               // plain object snapshot of all above
```

### Write

```javascript
Mewsic.settings.setTheme("light")
Mewsic.settings.setAccentColor("rose")
Mewsic.settings.setGuiScale(1.1)
Mewsic.settings.setDiscordEnabled(false)
Mewsic.settings.setSystemNotifications(true)
Mewsic.settings.setTrayEnabled(true)
Mewsic.settings.setSmoothScrollEnabled(false)
Mewsic.settings.setRepeatMode("all")
Mewsic.settings.setShuffle(true)
Mewsic.settings.setLibraryViewMode("list")
Mewsic.settings.setHomeViewMode("grid")
Mewsic.settings.setPlaylistViewMode("list")
Mewsic.settings.setShortcut("togglePlay", "k")
Mewsic.settings.setShortcut("volumeUp", "=", { ctrl: true })
Mewsic.settings.resetShortcuts()
```

Valid shortcut actions: `togglePlay`, `skipForward`, `skipBackward`, `playNext`, `playPrev`, `volumeUp`, `volumeDown`.

---

## `Mewsic.storage`

Namespaced localStorage — keys are prefixed with `mewsic_plugin_<pluginId>_` automatically.

```javascript
Mewsic.storage.set("my-plugin", "key", { any: "value" });
Mewsic.storage.get("my-plugin", "key");       // auto-deserialized
Mewsic.storage.remove("my-plugin", "key");
Mewsic.storage.keys("my-plugin");             // string[]
Mewsic.storage.clear("my-plugin");            // wipe all plugin data
```

---

## `Mewsic.events`

### System events

```javascript
const handler = (data) => console.log(data);
Mewsic.events.on("track_changed", handler);
Mewsic.events.off("track_changed", handler);
Mewsic.events.once("track_changed", handler);   // fires once then unsubscribes
```

| Event | Payload |
| :--- | :--- |
| `track_changed` | `Track \| null` |
| `playback_state_changed` | `boolean` |
| `time_changed` | `number` (seconds) |
| `volume_changed` | `number` (0–1) |
| `shuffle_changed` | `boolean` |
| `repeat_changed` | `"off" \| "one" \| "all"` |
| `queue_changed` | `Track[]` |
| `view_changed` | `string` |
| `playlist_changed` | `string \| null` |
| `library_changed` | `Track[]` |
| `playlists_changed` | `Playlist[]` |
| `theme_changed` | `"dark" \| "light"` |
| `accent_changed` | `string` |
| `reverb_changed` | `{ enabled, strength }` |
| `bass_boost_changed` | `number` |
| `volume_boost_changed` | `number` |
| `playback_speed_changed` | `number` |
| `eq_changed` | `number[]` |
| `track_loading` | `{ trackId }` |
| `track_error` | `{ trackId, error }` |

### Custom inter-plugin events

```javascript
Mewsic.events.emit("my-plugin:event", { data: 123 });
Mewsic.events.onCustom("my-plugin:event", (payload) => console.log(payload));
Mewsic.events.offCustom("my-plugin:event", handler);
```

---

## Track type reference

```typescript
interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;       // seconds
  filePath: string;       // local path or remote URL
  coverArt?: string;
  isVirtual?: boolean;    // shows Virtual badge in library
  provider?: string;      // plugin id that added it
  genre?: string;
  year?: number;
  trackNumber?: number;
  fileSize?: number;
  bitrate?: number;
}
```

---

## Complete plugin example

This example demonstrates every major pattern — sidebar view, event listening, storage, DSP control, virtual tracks, and search.

```javascript
(() => {
  const M = window.Mewsic;
  const ID = "demo-plugin";

  // Persist a setting across sessions
  let callCount = parseInt(M.storage.get(ID, "callCount") || "0", 10);

  // React to track changes
  M.events.on("track_changed", (track) => {
    callCount++;
    M.storage.set(ID, "callCount", callCount);

    if (!track) return;

    // Auto-apply a warm EQ whenever a track starts
    M.audio.setEqGains([4, 3, 1, 0, 0, 0, 0, -1, -2, -3]);

    // Show a toast with the track title
    M.ui.addNotification(`Now playing: ${track.title}`, "info", 2000, "Demo Plugin");
  });

  // Add a virtual track to the library
  M.library.addVirtualTrack({
    id: `${ID}:example-001`,
    title: "Example Stream",
    artist: "Demo Artist",
    album: "Plugin Tracks",
    duration: 180,
    filePath: "https://example.com/stream.mp3",
    isVirtual: true,
    provider: ID,
    coverArt: ""
  });

  // Register a resolver — intercept plugin:// URLs
  M.player.registerResolver(async (url) => {
    if (!url.startsWith("plugin://demo/")) return null;
    const id = url.replace("plugin://demo/", "");
    return { url: `https://example.com/audio/${id}.mp3` };
  });

  // Register a search provider
  M.ui.registerSearchProvider(ID, {
    name: "Demo Source",
    search: async (query) => {
      // Replace with a real API call
      return [{
        id: `${ID}:search-result`,
        title: `Result for "${query}"`,
        artist: "Demo",
        album: "",
        duration: 120,
        coverArt: "",
        url: "plugin://demo/result"
      }];
    }
  });

  // Sidebar icon
  M.ui.registerSidebarComponent(ID, {
    name: "Demo Plugin",
    icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>`,
    viewId: `plugin:${ID}`
  });

  // Custom view
  M.ui.registerTab(`plugin:${ID}`, {
    render: (container) => {
      container.innerHTML = "";
      container.style.cssText = "padding:24px;color:var(--text-primary);font-family:inherit;";

      const state = M.player.getState();
      const settings = M.settings.get();

      container.innerHTML = `
        <h1 style="font-weight:800;font-size:1.4rem;margin-bottom:4px;">Demo Plugin</h1>
        <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:24px;">
          Showing all plugin API patterns
        </p>

        <div style="display:grid;gap:12px;">
          <div style="padding:16px;background:var(--surface-raised);border-radius:14px;border:1px solid var(--border-subtle);">
            <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-muted);font-weight:800;margin-bottom:8px;">Now Playing</p>
            <p style="font-weight:700;">${state.currentTrack?.title ?? "Nothing"}</p>
            <p style="font-size:0.82rem;color:var(--text-secondary);">${state.currentTrack?.artist ?? "—"}</p>
          </div>

          <div style="padding:16px;background:var(--surface-raised);border-radius:14px;border:1px solid var(--border-subtle);">
            <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.12em;color:var(--text-muted);font-weight:800;margin-bottom:8px;">Stats</p>
            <p style="font-size:0.85rem;">Tracks seen: <strong style="color:var(--text-accent);">${callCount}</strong></p>
            <p style="font-size:0.85rem;">Theme: <strong>${settings.theme}</strong></p>
          </div>

          <div style="display:flex;gap:8px;">
            <button id="dp-toggle-theme" style="flex:1;padding:10px;border-radius:12px;background:var(--accent-muted);border:none;color:var(--text-accent);font-weight:800;cursor:pointer;">
              Toggle Theme
            </button>
            <button id="dp-reset-eq" style="flex:1;padding:10px;border-radius:12px;background:var(--surface-raised);border:1px solid var(--border-subtle);color:var(--text-secondary);font-weight:700;cursor:pointer;">
              Reset EQ
            </button>
          </div>
        </div>
      `;

      container.querySelector("#dp-toggle-theme").onclick = () => {
        M.settings.setTheme(M.settings.theme === "dark" ? "light" : "dark");
      };
      container.querySelector("#dp-reset-eq").onclick = () => {
        M.audio.resetEq();
        M.ui.addNotification("EQ reset to flat", "info", 2000);
      };
    },
    cleanup: () => {}
  });

  // Cross-plugin messaging example
  M.events.emit(`${ID}:loaded`, { version: "1.0.0" });
  M.events.onCustom(`${ID}:loaded`, (data) => {
    console.log("[Demo Plugin] Received own load event:", data);
  });

  console.log("[Demo Plugin] Loaded. Track count:", callCount);
})();
```

---

## File associations

When installed via a built package (`.deb`, `.rpm`, `.msi`, `.dmg`), Mewsic registers as the default handler for:

| Extension | Action |
| :--- | :--- |
| `.mewsic` | Install the plugin, show a reload prompt |
| `.mp3`, `.flac`, `.wav`, `.ogg`, `.m4a`, `.aac`, `.opus`, `.aiff`, `.aif`, `.wma` | Play the file immediately |

Double-clicking a file while Mewsic is already running sends the path to the existing window without launching a second instance.
