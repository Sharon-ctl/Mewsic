import { useEffect, useRef, useCallback } from "react";

// Throttle interval for time updates. Now that the app is optimized with useShallow, 
// we can safely lower this to 200ms (5fps) for a much smoother progress bar without lag.
const TIME_UPDATE_INTERVAL = 200;
// Debounce for Discord RPC updates to prevent IPC clogging on rapid toggles/changes
const RPC_DEBOUNCE_MS = 300;

import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { readAudioFile, updateDiscordRpc, clearDiscordRpc, fetchTrackMetadata } from "../utils/tauriApi";

import { 
  audio, 
  initAudioContext, 
  setReverbEnabled, 
  setPlaybackSpeed, 
  setBassBoost, 
  setVolumeBoost,
  setEngineVolume,
  setReverbStrength,
  setLowEndMode,
  setEqGain
} from "../utils/audioEngine";

export function useAudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    volume,
    repeatMode,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    playNext,
    addNotification,
    discordEnabled,
    systemNotifications,
    reverbEnabled,
    reverbStrength,
    playbackSpeed,
    bassBoost,
    volumeBoost,
    eqGains,
    lowEndMode,
  } = useStore(useShallow((s) => ({
    currentTrack: s.currentTrack,
    isPlaying: s.isPlaying,
    volume: s.volume,
    repeatMode: s.repeatMode,
    setIsPlaying: s.setIsPlaying,
    setCurrentTime: s.setCurrentTime,
    setDuration: s.setDuration,
    playNext: s.playNext,
    addNotification: s.addNotification,
    discordEnabled: s.discordEnabled,
    systemNotifications: s.systemNotifications,
    reverbEnabled: s.reverbEnabled,
    reverbStrength: s.reverbStrength,
    playbackSpeed: s.playbackSpeed,
    bassBoost: s.bassBoost,
    volumeBoost: s.volumeBoost,
    eqGains: s.eqGains,
    lowEndMode: s.lowEndMode,
  })));

  const loadAbortRef = useRef<number>(0);

  useEffect(() => {
    if (!currentTrack) {
      audio.pause();
      audio.src = "";
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const loadId = ++loadAbortRef.current;
    
    try {
      const fileUrl = readAudioFile(currentTrack.filePath);
      
      // Stop current playback before switching
      audio.pause();
      audio.crossOrigin = "anonymous";
      audio.src = fileUrl;
      audio.currentTime = 0;

      if (isPlaying) {
        audio.play().catch((err: any) => {
          console.warn("Autoplay failed or was interrupted:", err);
        });
      }
    } catch (err) {
      console.error("Failed to load track:", err);
    }
  }, [currentTrack?.id]);

  // Handle play/pause state independently of track changes
  useEffect(() => {
    if (!currentTrack) return;
    if (isPlaying) {
      if (audio.paused) {
        audio.play().catch(() => {});
      }
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  const seekRequest = useStore((s) => s.seekRequest);
  useEffect(() => {
    if (seekRequest !== null) {
      audio.currentTime = seekRequest;
      useStore.getState().clearSeekRequest();
    }
  }, [seekRequest]);

  // Sync Volume
  useEffect(() => {
    setEngineVolume(volume);
  }, [volume]);

  // Sync Audio Engine Effects
  useEffect(() => {
    setReverbEnabled(reverbEnabled);
    setReverbStrength(reverbStrength);
    setPlaybackSpeed(playbackSpeed);
    setBassBoost(bassBoost);
    setVolumeBoost(volumeBoost);
  }, [reverbEnabled, playbackSpeed, bassBoost, volumeBoost, currentTrack?.id]);

  useEffect(() => {
    setLowEndMode(lowEndMode);
  }, [lowEndMode]);

  // Sync Equalizer
  useEffect(() => {
    if (Array.isArray(eqGains)) {
      eqGains.forEach((gain, i) => setEqGain(i, gain));
    }
  }, [eqGains]);
  
  const currentCoverUrlRef = useRef<string | undefined>(undefined);
  const lastTrackIdRef = useRef<string | null>(null);
  const rpcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (rpcTimeoutRef.current) clearTimeout(rpcTimeoutRef.current);

    const updatePresence = async () => {
      const state = useStore.getState();
      
      if (!currentTrack) {
        lastTrackIdRef.current = null;
        currentCoverUrlRef.current = undefined;
        clearDiscordRpc().catch(() => {});
        return;
      }

      let playlistName = "Mewsic";
      if (state.activePlaylistId) {
        const pl = state.playlists.find(p => p.id === state.activePlaylistId);
        if (pl) playlistName = pl.name;
      }

      // Handle metadata & notifications only on track change
      if (lastTrackIdRef.current !== currentTrack.id) {
        const isNewTrack = lastTrackIdRef.current !== currentTrack.id;
        lastTrackIdRef.current = currentTrack.id;

        // Cover handling
        if (state.discordCoverCache[currentTrack.id]) {
          let cached = state.discordCoverCache[currentTrack.id];
          if (cached === "none") cached = undefined as any;
          currentCoverUrlRef.current = cached;
        } else {
          currentCoverUrlRef.current = undefined;
          // Don't await this to avoid blocking the RPC update
          fetchTrackMetadata(`${currentTrack.title} ${currentTrack.artist}`).then(metadata => {
            if (metadata.coverArt) {
              useStore.getState().setDiscordCoverCache(currentTrack.id, metadata.coverArt);
              if (useStore.getState().currentTrack?.id === currentTrack.id) {
                currentCoverUrlRef.current = metadata.coverArt;
                // Re-trigger RPC update with cover
                updateDiscordRpc(
                  currentTrack.title,
                  currentTrack.artist,
                  useStore.getState().isPlaying,
                  audio.currentTime,
                  currentTrack.duration || audio.duration || 0,
                  playlistName,
                  metadata.coverArt
                ).catch(() => {});
              }
            } else {
              useStore.getState().setDiscordCoverCache(currentTrack.id, "none");
            }
          }).catch(() => {});
        }

        // Send System Notification
        if (state.systemNotifications && isNewTrack) {
          try {
            const { isPermissionGranted, requestPermission, sendNotification } = await import("@tauri-apps/plugin-notification");
            let hasPermission = await isPermissionGranted();
            if (!hasPermission) {
              const permission = await requestPermission();
              hasPermission = permission === "granted";
            }
            if (hasPermission) {
              sendNotification({
                title: `Now Playing: ${currentTrack.title}`,
                body: `${currentTrack.artist} — ${currentTrack.album}`,
                icon: currentCoverUrlRef.current,
              });
            }
          } catch (err) {
            console.warn("System notification failed:", err);
          }
        }
      }

      // Discord RPC Update
      if (state.discordEnabled) {
        updateDiscordRpc(
          currentTrack.title,
          currentTrack.artist,
          isPlaying,
          audio.currentTime,
          currentTrack.duration || audio.duration || 0,
          playlistName,
          currentCoverUrlRef.current
        ).catch(() => {});
      } else {
        clearDiscordRpc().catch(() => {});
      }
    };

    rpcTimeoutRef.current = setTimeout(updatePresence, RPC_DEBOUNCE_MS);

    return () => {
      if (rpcTimeoutRef.current) clearTimeout(rpcTimeoutRef.current);
    };
  }, [currentTrack?.id, isPlaying, discordEnabled, systemNotifications]);

  useEffect(() => {
    // Throttled time update — reduces store writes from ~15/s to 2/s 
    let lastTimeWrite = 0;
    const onTimeUpdate = () => {
      const now = performance.now();
      if (now - lastTimeWrite >= TIME_UPDATE_INTERVAL) {
        lastTimeWrite = now;
        setCurrentTime(audio.currentTime);
      }
    };
    const onDurationChange = () => {
      let d = audio.duration || 0;
      if (!isFinite(d)) {
        d = useStore.getState().currentTrack?.duration || 0;
      }
      setDuration(d);
    };
    const onEnded = () => {
      if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        // Add a small delay to automatic switching to ensure the audio engine
        // has finished the current track before we swap the source.
        setTimeout(() => {
          playNext();
        }, 100);
      }
    };
    const onPlay  = () => {
      initAudioContext();
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);
    const onError = (e: Event) => {
      console.error("Audio error:", e);
    };

    audio.addEventListener("timeupdate",      onTimeUpdate);
    audio.addEventListener("durationchange",  onDurationChange);
    audio.addEventListener("ended",           onEnded);
    audio.addEventListener("play",            onPlay);
    audio.addEventListener("pause",           onPause);
    audio.addEventListener("error",           onError);

    return () => {
      audio.removeEventListener("timeupdate",     onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended",          onEnded);
      audio.removeEventListener("play",           onPlay);
      audio.removeEventListener("pause",          onPause);
      audio.removeEventListener("error",          onError);
    };
  }, [repeatMode]);

  const seek = useCallback((time: number) => {
    audio.currentTime = time;
    setCurrentTime(time);
    
    // Update Discord RPC immediately on seek for responsiveness
    const state = useStore.getState();
    const track = state.currentTrack;
    if (track && state.discordEnabled) {
      let playlistName = "Mewsic";
      if (state.activePlaylistId) {
        const pl = state.playlists.find(p => p.id === state.activePlaylistId);
        if (pl) playlistName = pl.name;
      }
      updateDiscordRpc(track.title, track.artist, state.isPlaying, time, track.duration || audio.duration || 0, playlistName, currentCoverUrlRef.current).catch(() => {});
    }
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  return { seek, togglePlay, audioElement: audio };
}