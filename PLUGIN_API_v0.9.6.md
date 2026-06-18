# Mewsic Plugin API Documentation (v0.9.6)

The Mewsic Plugin API provides a robust set of interfaces to interact with the core audio engine, manage UI elements, and access application data. External plugins are sandboxed within the `.mewsic` directory format and injected dynamically at runtime.

All plugin APIs are accessible globally under `window.Mewsic`.

---

## `Mewsic.version`
Returns the current application version as a string (e.g., `"0.9.6"`).

---

## `Mewsic.player`
Controls the core audio playback and queue state.

### Methods
* **`play()`**
  Resumes playback.
* **`pause()`**
  Pauses playback.
* **`togglePlay()`**
  Toggles between play and pause.
* **`next()`**
  Skips to the next track in the queue.
* **`prev()`**
  Returns to the previous track in the queue.
* **`seek(time: number)`**
  Seeks to a specific time (in seconds).
* **`setVolume(volume: number)`**
  Sets the player volume (0.0 to 1.0).
* **`fadeVolume(targetVolume: number, duration: number)`**
  Smoothly fades the volume to `targetVolume` over the specified `duration` (in milliseconds). Useful for crossfading or sleep timers.
* **`setPlaybackRate(speed: number)`**
  Sets the playback speed multiplier (e.g., `1.0` is normal, `0.5` is half speed, `2.0` is double speed).
* **`toggleShuffle()`**
  Toggles the shuffle state of the current queue.
* **`setRepeatMode(mode: "off" | "one" | "all")`**
  Sets the queue repetition behavior.
* **`getState()`**
  Returns a snapshot of the entire player state. Useful for initial synchronization.
* **`playTrack(trackId: string): Promise<void>`**
  Locates a track by ID in the library and immediately plays it, restructuring the queue around it.
* **`setQueue(tracks: Track[], startIndex?: number): Promise<void>`**
  Replaces the current queue with a new array of `Track` objects and begins playback at the given `startIndex`.
* **`addToQueue(track: Track)`**
  Appends a single `Track` to the end of the current queue.
* **`clearQueue()`**
  Stops playback and clears the active queue.

### Properties (Read-Only)
* **`currentTrack: Track | null`**
* **`isPlaying: boolean`**
* **`volume: number`**
* **`queue: Track[]`**
* **`currentTime: number`**
* **`shuffleEnabled: boolean`**
* **`repeatMode: "off" | "one" | "all"`**
* **`currentPlaylistName: string | null`**

---

## `Mewsic.library`
Access the user's localized track and playlist data.

### Methods
* **`playPlaylist(playlistId: string)`**
  Loads a playlist by ID into the queue and starts playback.
* **`search(query: string): Track[]`**
  Returns a list of tracks matching the search query by title, artist, or album.

### Properties (Read-Only)
* **`tracks: Track[]`**
  Array of all tracks indexed in the user's library.
* **`playlists: Playlist[]`**
  Array of all user-created playlists.

---

## `Mewsic.ui`
Inject custom views, sidebars, and interact with the application layout.

### Methods
* **`addNotification(message: string, type?: "info" | "success" | "error", duration?: number, title?: string)`**
  Triggers a toast notification in the application. Default duration is 5000ms.
* **`setTheme(theme: "dark" | "light")`**
  Forces the application color scheme.
* **`setAccentColor(colorHex: string)`**
  Updates the global CSS accent color across the app.
* **`setView(viewId: string)`**
  Navigates the main application window to the specified view (e.g., `"home"`, `"library"`, or a custom plugin view).
* **`registerSidebarComponent(id: string, config: { name: string; icon: string; viewId: string })`**
  Injects a new tab into the left sidebar.
  * `icon`: Must be an inline SVG string.
* **`registerTab(id: string, config: { render: (container: HTMLElement) => void; cleanup?: () => void })`**
  Registers a custom view that can be navigated to. The `render` function is called when the tab mounts, and `cleanup` is called when unmounting.
* **`registerOverlay(id: string, domElement: HTMLElement)`**
  Injects a persistent, floating DOM element over the entire application. It automatically gets `position: fixed` and `pointer-events: none`.
* **`removeOverlay(id: string)`**
  Removes a previously registered overlay.

### Properties
* **`activeView: string`** (Read-Only)
* **`registry: Object`** (Read-Only) Access to the internal UI element maps.

---

## `Mewsic.storage`
A sandboxed key-value store specific to your plugin. Data is persisted securely and will not collide with other plugins.

### Methods
* **`set(pluginId: string, key: string, value: any)`**
* **`get(pluginId: string, key: string): any`**
* **`remove(pluginId: string, key: string)`**

---

## `Mewsic.events`
Hook into the application lifecycle.

### Methods
* **`on(eventName: string, callback: Function)`**
* **`off(eventName: string, callback: Function)`**

### Available Events
* `"track_changed"`: Payload is the new `Track` object.
* `"playback_state_changed"`: Payload is a boolean (`isPlaying`).
* `"volume_changed"`: Payload is a number.
* `"time_changed"`: Payload is a number (current playback time).
* `"shuffle_changed"`: Payload is a boolean.
* `"repeat_changed"`: Payload is the repeat mode string.
* `"view_changed"`: Payload is the string ID of the new view.
* `"queue_changed"`: Payload is the new `Track[]` array.
* `"playlist_changed"`: Payload is the playlist name string or `null`.
