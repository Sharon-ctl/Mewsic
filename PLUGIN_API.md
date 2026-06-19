# Mewsic Plugin API

Plugins are plain JavaScript files placed in Mewsic's plugin directory. They run inside the app's webview and have full access to the `window.Mewsic` global the moment the app has loaded.

```javascript
// Basic plugin entry point
console.log("Hello from my plugin!", window.Mewsic.version);
```

The API is split into six namespaces:

| Namespace | Purpose |
| :--- | :--- |
| `Mewsic.player` | Playback control and queue management |
| `Mewsic.library` | Track and playlist CRUD |
| `Mewsic.audio` | DSP — EQ, reverb, speed, presets |
| `Mewsic.ui` | Views, overlays, search providers, CSS injection |
| `Mewsic.settings` | App settings — read and write |
| `Mewsic.storage` | Isolated per-plugin key-value persistence |
| `Mewsic.events` | Subscribe to system events and emit custom ones |

---

## `Mewsic.player`

### Getters

| Property | Type | Description |
| :--- | :--- | :--- |
| `currentTrack` | `Track \| null` | The active track object |
| `isPlaying` | `boolean` | Whether audio is playing |
| `volume` | `number` | Current volume (0–1) |
| `queue` | `Track[]` | The active play queue |
| `queueIndex` | `number` | Index of the current track in the queue |
| `currentTime` | `number` | Playhead position in seconds |
| `duration` | `number` | Active track duration in seconds |
| `shuffleEnabled` | `boolean` | Whether shuffle is on |
| `repeatMode` | `"off" \| "one" \| "all"` | Current repeat mode |
| `currentPlaylistName` | `string \| null` | Name of the active playlist, or null |

### Methods

```javascript
Mewsic.player.play()
Mewsic.player.pause()
Mewsic.player.togglePlay()
Mewsic.player.next()
Mewsic.player.prev()
Mewsic.player.seek(seconds)
Mewsic.player.skipForward(seconds = 5)
Mewsic.player.skipBackward(seconds = 5)
Mewsic.player.setVolume(0.0 – 1.0)
Mewsic.player.toggleMute()
Mewsic.player.fadeVolume(targetVolume, durationMs)
Mewsic.player.setPlaybackRate(speed)   // 0.5 – 2.0
Mewsic.player.toggleShuffle()
Mewsic.player.setRepeatMode("off" | "one" | "all")
Mewsic.player.getState()               // snapshot of all player state
```

### Queue management

```javascript
// Play a local track by its ID
await Mewsic.player.playTrack("track-id");

// Play a virtual/remote track directly
await Mewsic.player.playVirtualTrack({
  id: "spotify:track:4PTG3Z6ehGkBF3zIqYQGSy",
  title: "Stay",
  artist: "The Kid LAROI",
  album: "F*CK LOVE 3",
  duration: 141,
  filePath: "https://open.spotify.com/track/4PTG3Z6ehGkBF3zIqYQGSy",
  isVirtual: true,
  provider: "virtual",
  coverArt: "https://i.scdn.co/image/..."
});

// Replace the whole queue
await Mewsic.player.setQueue(tracks, startIndex);

Mewsic.player.addToQueue(track);
Mewsic.player.removeFromQueue("track-id");
Mewsic.player.clearQueue();
```

### Stream resolvers

Plugins can intercept playback of remote URLs (Spotify, SoundCloud, custom schemes, etc.) and resolve them to a playable direct audio URL before the audio engine loads them.

```javascript
Mewsic.player.registerResolver(async (url) => {
  if (!url.startsWith("https://open.spotify.com/")) return null;

  const streamUrl = await mySpotifyProxy.resolve(url);
  return {
    url: streamUrl,           // required — direct playable audio URL
    title: "Stay",            // optional — overrides track metadata
    artist: "The Kid LAROI",
    duration: 141,
    coverArt: "https://..."
  };
});
```

Multiple resolvers can be registered. They are tried in order; the first non-null result wins.

---

## `Mewsic.library`

### Getters

| Property | Type | Description |
| :--- | :--- | :--- |
| `tracks` | `Track[]` | All tracks (local + virtual) |
| `virtualTracks` | `Track[]` | Only virtual tracks |
| `playlists` | `Playlist[]` | All playlists |
| `musicDir` | `string` | Path to the user's music folder |
| `isScanning` | `boolean` | Whether a library scan is in progress |

### Track methods

```javascript
Mewsic.library.getTrack("track-id");           // Track | null
Mewsic.library.addTracks([...tracks]);
Mewsic.library.updateTrack(track);
Mewsic.library.addVirtualTrack(track);         // adds with isVirtual: true
Mewsic.library.removeVirtualTrack("track-id");
```

### Playlist methods

```javascript
Mewsic.library.getPlaylist("playlist-id");                    // Playlist | null
Mewsic.library.getPlaylistTracks("playlist-id");              // Track[]
Mewsic.library.addPlaylist(playlist);
Mewsic.library.updatePlaylist(playlist);
Mewsic.library.removePlaylist("playlist-id");
Mewsic.library.addTrackToPlaylist("track-id", "playlist-id");
Mewsic.library.removeTrackFromPlaylist("track-id", "playlist-id");
Mewsic.library.playPlaylist("playlist-id", startIndex = 0);
```

### Search

```javascript
const results = Mewsic.library.search("daft punk");
// searches title, artist, and album across all tracks
```

### Download

Triggers Mewsic's built-in yt-dlp downloader to save a URL to the user's music folder.

```javascript
await Mewsic.library.downloadTrack({
  title: "Get Lucky",
  artist: "Daft Punk",
  album: "Random Access Memories",
  coverArt: "https://...",
  url: "https://www.youtube.com/watch?v=5NV6Rdv1a3I",
  onProgress: (pct) => console.log(`${pct}% done`)
});
```

---

## `Mewsic.audio`

Full read and write access to the DSP chain.

### Getters

| Property | Type | Description |
| :--- | :--- | :--- |
| `reverbEnabled` | `boolean` | Whether reverb is active |
| `reverbStrength` | `number` | Reverb wet mix (0–1) |
| `bassBoost` | `number` | Bass boost in dB |
| `volumeBoost` | `number` | Volume multiplier (0.5–3) |
| `playbackSpeed` | `number` | Playback rate (0.5–2.0) |
| `eqGains` | `number[]` | 10 EQ band gains in dB |
| `activePresetId` | `string \| null` | Currently applied preset ID |
| `presets` | `AudioPreset[]` | All saved presets |

### Methods

```javascript
Mewsic.audio.setReverb(enabled, strength?)    // strength 0.0 – 1.0
Mewsic.audio.setBassBoost(db)
Mewsic.audio.setVolumeBoost(multiplier)       // 0.5 – 3.0
Mewsic.audio.setPlaybackSpeed(speed)          // 0.5 – 2.0
Mewsic.audio.setEqGain(bandIndex, db)         // 0 – 9
Mewsic.audio.setEqGains([...10 values])       // set all bands at once
Mewsic.audio.resetEq()
Mewsic.audio.resetAll()                       // reset EQ + all effects to defaults
Mewsic.audio.applyPreset("preset-id")
Mewsic.audio.savePreset("My Preset")
Mewsic.audio.deletePreset("preset-id")
Mewsic.audio.getState()                       // snapshot of all DSP state
```

---

## `Mewsic.ui`

### Getters

| Property | Type |
| :--- | :--- |
| `activeView` | `string` |
| `theme` | `"dark" \| "light"` |
| `accentColor` | `string` |
| `guiScale` | `number` |
| `isFullscreen` | `boolean` |

### Navigation

```javascript
Mewsic.ui.setView("library")         // any built-in view id
Mewsic.ui.openLibrary()
Mewsic.ui.openPlayer()
Mewsic.ui.openSettings()
Mewsic.ui.openPlaylist("playlist-id")
Mewsic.ui.setSearchQuery("query")    // pre-fill the search bar
```

### Appearance

```javascript
Mewsic.ui.setTheme("dark" | "light")
Mewsic.ui.setAccentColor("mint")     // any AccentPreset id
Mewsic.ui.setGuiScale(1.0)          // 0.75 – 1.5
```

### Notifications (toast)

```javascript
const id = Mewsic.ui.addNotification("Synced!", "success", 3000, "Spotify");
Mewsic.ui.dismissNotification(id);
```

`type` is `"info" | "success" | "error"`. Duration is in ms; `0` means persistent until dismissed.

### Sidebar components

Registers a clickable icon in the sidebar that routes to a custom plugin view.

```javascript
Mewsic.ui.registerSidebarComponent("spotify", {
  name: "Spotify",
  icon: "<svg>...</svg>",   // raw SVG string
  viewId: "plugin:spotify"
});

Mewsic.ui.unregisterSidebarComponent("spotify");
```

### Custom tabs / views

The `viewId` used in `registerSidebarComponent` must match the id you register here.

```javascript
Mewsic.ui.registerTab("plugin:spotify", {
  render: (container) => {
    container.innerHTML = "<h1>Spotify</h1>";
  },
  cleanup: () => {
    // called when the tab is unregistered or the plugin is unloaded
  }
});

Mewsic.ui.unregisterTab("plugin:spotify");
```

### Overlays

Appends a fixed DOM element over the entire app window. `pointerEvents` defaults to `none` so it does not block the UI unless you enable it explicitly.

```javascript
const el = document.createElement("div");
el.textContent = "♫";
el.style.pointerEvents = "auto";

Mewsic.ui.registerOverlay("now-playing-badge", el);
Mewsic.ui.removeOverlay("now-playing-badge");
```

### Search providers

Injects a custom search engine into the Harbour search dropdown.

```javascript
Mewsic.ui.registerSearchProvider("spotify", {
  name: "Spotify",
  search: async (query) => {
    const results = await fetchSpotifyResults(query);
    return results.map(t => ({
      id: t.id,
      title: t.name,
      artist: t.artists[0].name,
      album: t.album.name,
      duration: Math.floor(t.duration_ms / 1000),
      coverArt: t.album.images[0]?.url,
      url: t.external_urls.spotify
    }));
  },
  download: async (track, musicDir, onProgress) => {
    const streamUrl = await resolveToYoutube(track.url);
    await Mewsic.library.downloadTrack({
      ...track,
      url: streamUrl,
      onProgress
    });
  }
});

Mewsic.ui.unregisterSearchProvider("spotify");
```

### CSS injection

```javascript
Mewsic.ui.injectCSS("my-plugin", `
  .sidebar { border-right: 2px solid hotpink; }
`);

Mewsic.ui.removeCSS("my-plugin");
```

---

## `Mewsic.settings`

Read and write access to persistent app settings.

### Getters

| Property | Type |
| :--- | :--- |
| `theme` | `"dark" \| "light"` |
| `accentColor` | `string` |
| `guiScale` | `number` |
| `discordEnabled` | `boolean` |
| `systemNotifications` | `boolean` |
| `trayEnabled` | `boolean` |
| `smoothScrollEnabled` | `boolean` |
| `repeatMode` | `"off" \| "one" \| "all"` |
| `shuffleEnabled` | `boolean` |
| `libraryViewMode` | `"grid" \| "list"` |
| `homeViewMode` | `"grid" \| "list"` |
| `playlistViewMode` | `"grid" \| "list"` |
| `shortcuts` | `ShortcutMap` (copy) |

### Setters

```javascript
Mewsic.settings.setTheme("dark" | "light")
Mewsic.settings.setAccentColor("violet")
Mewsic.settings.setGuiScale(1.0)               // 0.75 – 1.5
Mewsic.settings.setDiscordEnabled(true)
Mewsic.settings.setSystemNotifications(false)
Mewsic.settings.setTrayEnabled(true)           // also syncs with OS tray
Mewsic.settings.setSmoothScrollEnabled(true)
Mewsic.settings.setRepeatMode("all")
Mewsic.settings.setShuffle(true)
Mewsic.settings.setLibraryViewMode("grid")
Mewsic.settings.setHomeViewMode("list")
Mewsic.settings.setPlaylistViewMode("grid")

// Remap a keyboard shortcut
Mewsic.settings.setShortcut("togglePlay", "k")
Mewsic.settings.setShortcut("volumeUp", "=", { ctrl: true })
Mewsic.settings.resetShortcuts()
```

Valid shortcut action names: `togglePlay`, `skipForward`, `skipBackward`, `playNext`, `playPrev`, `volumeUp`, `volumeDown`.

### Snapshot

```javascript
const all = Mewsic.settings.get();
// returns a plain object copy of all settings listed above
```

---

## `Mewsic.storage`

Namespaced, per-plugin localStorage wrapper. All keys are isolated under `mewsic_plugin_<pluginId>_`.

```javascript
Mewsic.storage.set("my-plugin", "token", "ya29.a0...");
const token = Mewsic.storage.get("my-plugin", "token");
Mewsic.storage.remove("my-plugin", "token");

// Inspect what a plugin has stored
const keys = Mewsic.storage.keys("my-plugin");  // string[]

// Wipe everything a plugin stored
Mewsic.storage.clear("my-plugin");
```

Values are automatically JSON serialized on write and deserialized on read.

---

## `Mewsic.events`

### System events

Subscribe to changes happening inside the app.

```javascript
const handler = (track) => console.log("Now playing:", track?.title);
Mewsic.events.on("track_changed", handler);
Mewsic.events.off("track_changed", handler);

// Auto-unsubscribe after the first call
Mewsic.events.once("track_changed", (track) => {
  console.log("First track loaded:", track?.title);
});
```

| Event | Payload |
| :--- | :--- |
| `track_changed` | `Track \| null` |
| `playback_state_changed` | `boolean` (isPlaying) |
| `time_changed` | `number` (seconds) |
| `volume_changed` | `number` (0–1) |
| `shuffle_changed` | `boolean` |
| `repeat_changed` | `"off" \| "one" \| "all"` |
| `queue_changed` | `Track[]` |
| `view_changed` | `string` (view id) |
| `playlist_changed` | `string \| null` (playlist name) |
| `library_changed` | `Track[]` |
| `playlists_changed` | `Playlist[]` |
| `theme_changed` | `"dark" \| "light"` |
| `accent_changed` | `string` |
| `reverb_changed` | `{ enabled: boolean, strength: number }` |
| `bass_boost_changed` | `number` |
| `volume_boost_changed` | `number` |
| `playback_speed_changed` | `number` |
| `eq_changed` | `number[]` (10 band gains) |
| `track_loading` | `{ trackId: string }` |
| `track_error` | `{ trackId: string, error: string }` |

### Custom inter-plugin events

Plugins can talk to each other through a separate custom event bus that doesn't interfere with system events.

```javascript
// Plugin A emits
Mewsic.events.emit("my-plugin:sync-done", { count: 42 });

// Plugin B listens
Mewsic.events.onCustom("my-plugin:sync-done", (data) => {
  console.log("Synced", data.count, "tracks");
});

Mewsic.events.offCustom("my-plugin:sync-done", handler);
```

---

## Track object reference

```typescript
interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;        // seconds
  filePath: string;        // local path or remote URL
  coverArt?: string;
  isVirtual?: boolean;     // true for remote/plugin-provided tracks
  provider?: string;       // e.g. "virtual", "spotify"
  genre?: string;
  year?: number;
  trackNumber?: number;
  fileSize?: number;
  bitrate?: number;
}
```

---

## Spotify integration example

A minimal sketch of what a Spotify plugin looks like end-to-end.

```javascript
// 1. Authenticate and get a token somehow (OAuth PKCE flow in an overlay, etc.)
const token = Mewsic.storage.get("spotify", "access_token");

// 2. Register a stream resolver so Spotify URLs play correctly
Mewsic.player.registerResolver(async (url) => {
  if (!url.includes("spotify.com/track")) return null;
  const trackId = url.split("/track/")[1];
  const streamUrl = await myProxy.getStreamUrl(trackId, token);
  return { url: streamUrl };
});

// 3. Register a search provider in Harbour
Mewsic.ui.registerSearchProvider("spotify", {
  name: "Spotify",
  search: async (query) => {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(r => r.json());
    return res.tracks.items.map(t => ({
      id: t.id,
      title: t.name,
      artist: t.artists[0].name,
      album: t.album.name,
      duration: Math.floor(t.duration_ms / 1000),
      coverArt: t.album.images[0]?.url,
      url: t.external_urls.spotify
    }));
  }
});

// 4. Save a Spotify track to the Mewsic library (shows with a Virtual badge)
Mewsic.library.addVirtualTrack({
  id: "spotify:track:4PTG3Z6ehGkBF3zIqYQGSy",
  title: "Stay",
  artist: "The Kid LAROI",
  album: "F*CK LOVE 3: OVER YOU",
  duration: 141,
  filePath: "https://open.spotify.com/track/4PTG3Z6ehGkBF3zIqYQGSy",
  isVirtual: true,
  provider: "virtual",
  coverArt: "https://i.scdn.co/image/..."
});
```
