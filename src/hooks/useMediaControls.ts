import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useStore } from "../store";
import { useRef } from "react";
import {
  updateMediaMetadata,
  updateMediaPlayback,
  clearMediaControls,
  getCoverArt,
} from "../utils/tauriApi";

export function useMediaControls() {
  const currentTrack = useStore(s => s.currentTrack);
  const isPlaying = useStore(s => s.isPlaying);
  const seekRequest = useStore(s => s.seekRequest);

  const lastTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!currentTrack) {
      lastTrackIdRef.current = null;
      clearMediaControls().catch(() => {});
      if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
      return;
    }

    if (lastTrackIdRef.current === currentTrack.id) return;
    lastTrackIdRef.current = currentTrack.id;

    const syncMetadata = async () => {
      const state = useStore.getState();
      let coverUrl: string | undefined;

      const cached = state.discordCoverCache?.[currentTrack.id];
      if (cached && cached !== "none") {
        coverUrl = cached;
      } else {
        const localCover = await getCoverArt(currentTrack.filePath);
        if (localCover) coverUrl = localCover;
      }

      await updateMediaMetadata(
        currentTrack.title,
        currentTrack.artist,
        currentTrack.album,
        coverUrl,
        currentTrack.duration || undefined
      );

      if ("mediaSession" in navigator && (window as any).MediaMetadata) {
        navigator.mediaSession.metadata = new (window as any).MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          artwork: coverUrl ? [{ src: coverUrl, sizes: "512x512" }] : undefined,
        });
      }

      updateMediaPlayback(useStore.getState().isPlaying, useStore.getState().currentTime || 0).catch(() => {});
    };

    syncMetadata().catch(() => {});
  }, [currentTrack?.id]);

  const lastSyncRef = useRef(0);

  useEffect(() => {
    updateMediaPlayback(isPlaying, useStore.getState().currentTime || 0).catch(() => {});
    lastSyncRef.current = Date.now();
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      const state = useStore.getState();
      updateMediaPlayback(state.isPlaying, state.currentTime || 0).catch(() => {});
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    if (seekRequest !== null) {
      updateMediaPlayback(isPlaying, seekRequest).catch(() => {});
    }
  }, [seekRequest, isPlaying]);

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];

    const subscribe = async () => {
      unlisteners.push(
        await listen("media-play", () => {
          if (useStore.getState().currentTrack) useStore.getState().setIsPlaying(true);
        })
      );
      unlisteners.push(
        await listen("media-pause", () => useStore.getState().setIsPlaying(false))
      );
      unlisteners.push(
        await listen("media-toggle", () => {
          const { isPlaying, currentTrack, setIsPlaying } = useStore.getState();
          if (currentTrack) setIsPlaying(!isPlaying);
        })
      );
      unlisteners.push(
        await listen("media-next", () => useStore.getState().playNext())
      );
      unlisteners.push(
        await listen("media-previous", () => useStore.getState().playPrev())
      );
      unlisteners.push(
        await listen("media-stop", () => useStore.getState().setIsPlaying(false))
      );
    };

    subscribe();

    if ("mediaSession" in navigator) {
      navigator.mediaSession.setActionHandler("play", () => useStore.getState().setIsPlaying(true));
      navigator.mediaSession.setActionHandler("pause", () => useStore.getState().setIsPlaying(false));
      navigator.mediaSession.setActionHandler("previoustrack", () => useStore.getState().playPrev());
      navigator.mediaSession.setActionHandler("nexttrack", () => useStore.getState().playNext());
    }

    return () => {
      unlisteners.forEach(fn => fn());
      if ("mediaSession" in navigator) {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("previoustrack", null);
        navigator.mediaSession.setActionHandler("nexttrack", null);
      }
    };
  }, []);
}
