import { useEffect, useRef } from "react";

const TIME_UPDATE_INTERVAL = 50;
const RPC_DEBOUNCE_MS = 300;

import { useStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { readAudioFile, updateDiscordRpc, clearDiscordRpc, fetchTrackMetadata, resolveStreamMetadata } from "../utils/tauriApi";

function isDirectMediaUrl(url: string) {
  const cleanUrl = url.split("?")[0].split("#")[0];
  const ext = cleanUrl.split(".").pop()?.toLowerCase();
  return ["mp3", "wav", "ogg", "flac", "m4a", "aac", "mp4"].includes(ext || "");
}

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
  setEqGain,
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
  } = useStore(useShallow(s => ({
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
  const isSeeking = useRef<boolean>(false);
  const lastSeekTime = useRef<number>(0);

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

    const loadAndPlay = async () => {
      try {
        let fileUrl = readAudioFile(currentTrack.filePath);

        if (fileUrl.startsWith("http://") || fileUrl.startsWith("https://") || fileUrl.startsWith("ytsearch:")) {
          if (!fileUrl.startsWith("http://127.0.0.1:1422/")) {
            if (!isDirectMediaUrl(fileUrl)) {
              let resolved = null;

              if (window.Mewsic?.player?._resolvers) {
                for (const resolver of window.Mewsic.player._resolvers) {
                  try {
                    const result = await resolver(fileUrl);
                    if (result?.url) {
                      resolved = {
                        url: result.url,
                        title: result.title || currentTrack.title,
                        artist: result.artist || currentTrack.artist,
                        duration: result.duration || currentTrack.duration,
                        coverArt: result.coverArt || currentTrack.coverArt || "",
                      };
                      break;
                    }
                  } catch (e) {
                    console.error("Plugin resolver failed:", e);
                  }
                }
              }

              if (!resolved) {
                resolved = await resolveStreamMetadata(fileUrl);
              }

              fileUrl = resolved.url;
              
              // Only update if duration or cover art is missing, don't overwrite title/artist!
              const updates: any = {};
              if (!currentTrack.duration && resolved.duration) updates.duration = resolved.duration;
              if (!currentTrack.coverArt && resolved.coverArt) updates.coverArt = resolved.coverArt;
              
              if (Object.keys(updates).length > 0) {
                useStore.getState().updateTrack({
                  ...currentTrack,
                  ...updates
                });
              }
            }
            fileUrl = `http://127.0.0.1:1422/proxy?url=${encodeURIComponent(fileUrl)}`;
          }
        }

        if (loadId !== loadAbortRef.current) return;

        audio.pause();
        audio.crossOrigin = "anonymous";
        audio.src = fileUrl;
        audio.currentTime = 0;

        if (isPlaying) {
          audio.play().catch((err: any) => {
            console.warn("Autoplay failed:", err);
          });
        }
      } catch (err) {
        console.error("Failed to load track:", err);
        addNotification(`Failed to load stream: ${err}`, "error");
      }
    };

    loadAndPlay();
  }, [currentTrack?.id]);

  useEffect(() => {
    if (!currentTrack) return;
    if (isPlaying) {
      if (audio.paused) audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  const seekRequest = useStore(s => s.seekRequest);
  useEffect(() => {
    if (seekRequest !== null) {
      lastSeekTime.current = performance.now();
      isSeeking.current = true;
      audio.currentTime = seekRequest;
      setCurrentTime(seekRequest);
      useStore.getState().clearSeekRequest();
    }
  }, [seekRequest, setCurrentTime]);

  useEffect(() => { setEngineVolume(volume); }, [volume]);

  useEffect(() => {
    setReverbEnabled(reverbEnabled);
    setReverbStrength(reverbStrength);
    setPlaybackSpeed(playbackSpeed);
    setBassBoost(bassBoost);
    setVolumeBoost(volumeBoost);
  }, [reverbEnabled, reverbStrength, playbackSpeed, bassBoost, volumeBoost, currentTrack?.id]);

  useEffect(() => { setLowEndMode(lowEndMode); }, [lowEndMode]);

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

      if (lastTrackIdRef.current !== currentTrack.id) {
        lastTrackIdRef.current = currentTrack.id;

        if (state.discordCoverCache[currentTrack.id]) {
          const cached = state.discordCoverCache[currentTrack.id];
          currentCoverUrlRef.current = cached === "none" ? undefined : cached;
        } else {
          currentCoverUrlRef.current = undefined;
          fetchTrackMetadata(`${currentTrack.title} ${currentTrack.artist}`).then(metadata => {
            if (metadata.coverArt) {
              useStore.getState().setDiscordCoverCache(currentTrack.id, metadata.coverArt);
              if (useStore.getState().currentTrack?.id === currentTrack.id) {
                currentCoverUrlRef.current = metadata.coverArt;
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

        if (state.systemNotifications) {
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
    return () => { if (rpcTimeoutRef.current) clearTimeout(rpcTimeoutRef.current); };
  }, [currentTrack?.id, isPlaying, discordEnabled, systemNotifications]);

  useEffect(() => {
    let lastTimeWrite = 0;

    const onTimeUpdate = () => {
      if (isSeeking.current || performance.now() - lastSeekTime.current < 500) return;
      const now = performance.now();
      if (now - lastTimeWrite >= TIME_UPDATE_INTERVAL) {
        lastTimeWrite = now;
        setCurrentTime(audio.currentTime);
      }
    };

    const onDurationChange = () => {
      let d = audio.duration || 0;
      if (!isFinite(d)) d = useStore.getState().currentTrack?.duration || 0;
      setDuration(d);
    };

    const onEnded = () => {
      if (repeatMode === "one") {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        setTimeout(() => playNext(), 100);
      }
    };

    const onPlay = () => {
      if (!useStore.getState().safeAudioMode) initAudioContext();
      setIsPlaying(true);
    };
    const onPause = () => setIsPlaying(false);
    const onError = (e: Event) => console.error("Audio error:", e);
    const onSeeking = () => { isSeeking.current = true; };
    const onSeeked = () => { isSeeking.current = false; };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    audio.addEventListener("seeking", onSeeking);
    audio.addEventListener("seeked", onSeeked);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("seeking", onSeeking);
      audio.removeEventListener("seeked", onSeeked);
    };
  }, [repeatMode]);

  const seek = (time: number) => {
    lastSeekTime.current = performance.now();
    isSeeking.current = true;
    audio.currentTime = time;
    setCurrentTime(time);

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
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  return { seek, togglePlay, audioElement: audio };
}