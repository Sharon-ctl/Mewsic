import React from "react";
import {
  Volume2,
  Zap,
  Sliders,
  AudioWaveform,
  Radio,
  Headphones,
  AlertTriangle,
  RotateCcw
} from "lucide-react";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { ThemedSlider } from "../UI/ThemedSlider";

export function AudioView() {
  const {
    volume, setVolume,
    reverbEnabled, setReverbEnabled,
    reverbStrength, setReverbStrength,
    bassBoost, setBassBoost,
    playbackSpeed, setPlaybackSpeed,
    volumeBoost, setVolumeBoost,
    resetAudioEffects,
    isDevMode,
    lowEndMode,
  } = useStore(useShallow((s) => ({
    volume: s.volume ?? 0.8,
    setVolume: s.setVolume,
    reverbEnabled: s.reverbEnabled ?? false,
    setReverbEnabled: s.setReverbEnabled,
    reverbStrength: s.reverbStrength ?? 0.5,
    setReverbStrength: s.setReverbStrength,
    bassBoost: s.bassBoost ?? 0,
    setBassBoost: s.setBassBoost,
    playbackSpeed: s.playbackSpeed ?? 1.0,
    setPlaybackSpeed: s.setPlaybackSpeed,
    volumeBoost: s.volumeBoost ?? 1.0,
    setVolumeBoost: s.setVolumeBoost,
    resetAudioEffects: s.resetAudioEffects,
    isDevMode: s.isDevMode,
    lowEndMode: s.lowEndMode,
  })));

  if (!isDevMode) {
    return (
      <div className="flex-1 flex flex-col h-full bg-surface-base text-text-primary overflow-hidden page">
        <div className="h-full flex flex-col items-center justify-center space-y-6 animate-fade-in p-8">
          <div className="w-24 h-24 rounded-[2rem] bg-accent/5 flex items-center justify-center text-accent/20 border border-accent/10 shadow-[0_0_50px_rgba(var(--accent-rgb),0.05)]">
            <Zap size={48} className="animate-pulse" />
          </div>
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-black tracking-tight text-text-primary">Coming Soon</h2>
            <p className="text-sm text-text-muted max-w-sm mx-auto leading-relaxed font-medium">
              The Mewsic Audio Engine is currently in private beta. We're working on optimizing the engine for high-fidelity audio and better features. Will be accessible for users in a future update!
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (lowEndMode) {
    return (
      <div className="flex-1 flex flex-col h-full bg-surface-base text-text-primary overflow-hidden page">
        <div className="h-full flex flex-col items-center justify-center space-y-6 animate-fade-in p-8">
          <div className="w-24 h-24 rounded-[2rem] bg-amber-500/5 flex items-center justify-center text-amber-500/20 border border-amber-500/10 shadow-[0_0_50px_rgba(245,158,11,0.05)]">
            <AlertTriangle size={48} className="animate-pulse" />
          </div>
          <div className="text-center space-y-3">
            <h2 className="text-3xl font-black tracking-tight text-text-primary">Engine Locked</h2>
            <p className="text-sm text-text-muted max-w-sm mx-auto leading-relaxed font-medium">
              Audio Engine customization is currently unavailable because <span className="text-amber-500 font-bold">Low-End Mode</span> is enabled in your settings. 
              <br/><br/>
              To maintain system stability and prevent audio stuttering on your device, DSP effects like Reverb and Bass Boost are restricted.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-base text-text-primary overflow-hidden page">
      {/* Header */}
      <header className="p-6 flex items-center justify-between border-b border-border-subtle bg-surface-base/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center text-accent">
            <AudioWaveform size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Mewsic Audio Engine</h1>
            <p className="text-sm text-text-muted">designed for high quality audio</p>
          </div>
        </div>
        <button
          onClick={resetAudioEffects}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-red-500 transition-all active:scale-95"
        >
          Reset Engine
        </button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">

          {/* Master Volume Card */}
          <section className="glass rounded-[2rem] p-10 border border-border-subtle relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
              <Volume2 size={320} className="text-accent" />
            </div>

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent">
                    <Volume2 size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Volume</h2>
                    <p className="text-xs text-text-muted uppercase tracking-widest font-medium">primary gain controller</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="text-5xl font-black text-accent tracking-tighter tabular-nums leading-none">
                    {Math.round(volume * 100)}%
                  </div>
                  <button
                    onClick={() => setVolume(0.8)}
                    className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle text-text-muted hover:text-accent hover:border-accent transition-all active:scale-90"
                    title="Reset to 80%"
                  >
                    <RotateCcw size={12} />
                  </button>
                </div>
              </div>

              <div className="px-4">
                <ThemedSlider
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={setVolume}
                  formatTooltip={(v) => `${Math.round(v * 100)}%`}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
                {[
                  { label: "Rate", val: "48kHz" },
                  { label: "Depth", val: "24-Bit" },
                  { label: "Mode", val: "Stereo" },
                  { label: "Buffer", val: "Low-Lat" },
                ].map((s, i) => (
                  <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-[9px] font-black text-text-muted uppercase tracking-widest mb-1">{s.label}</p>
                    <p className="text-sm font-bold text-text-primary">{s.val}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Effects Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            {/* Reverb Card */}
            <div className="glass rounded-[2rem] p-8 border border-border-subtle flex flex-col group hover:border-accent/20 transition-all shadow-xl">
              <div className="flex justify-between items-start mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Reverberation</h3>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium">software reverb</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setReverbEnabled(false);
                      setReverbStrength(0.5);
                    }}
                    className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle text-text-muted hover:text-accent hover:border-accent transition-all active:scale-90"
                  >
                    <RotateCcw size={12} />
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={reverbEnabled}
                      onChange={() => setReverbEnabled(!reverbEnabled)}
                    />
                    <div className="w-9 h-5 bg-surface-raised rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent border border-border-subtle" />
                  </label>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">Wet Strength</p>
                  <span className="font-mono text-accent font-bold">{(reverbStrength * 100).toFixed(0)}%</span>
                </div>
                <ThemedSlider
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={reverbStrength}
                  onChange={setReverbStrength}
                />
                <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 flex items-start gap-3">
                  <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-red-500/80 font-bold uppercase leading-relaxed tracking-widest">
                    High intensity may cause signal clipping.
                  </p>
                </div>
              </div>
            </div>

            {/* Bass Card */}
            <div className="glass rounded-[2rem] p-8 border border-border-subtle space-y-8 group hover:border-accent/20 transition-all shadow-xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                    <Radio size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Bass Boost</h3>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium">higher bass</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-2xl font-black text-accent tabular-nums leading-none">+{bassBoost}dB</span>
                  <button
                    onClick={() => setBassBoost(0)}
                    className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle text-text-muted hover:text-accent hover:border-accent transition-all active:scale-90"
                  >
                    <RotateCcw size={10} />
                  </button>
                </div>
              </div>
              <ThemedSlider
                min={0}
                max={20}
                step={1}
                value={bassBoost}
                onChange={setBassBoost}
              />
            </div>

            {/* Speed Card */}
            <div className="glass rounded-[2rem] p-8 border border-border-subtle space-y-8 group hover:border-accent/20 transition-all shadow-xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                    <Sliders size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Playback Speed</h3>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium">Time-Stretching</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-2xl font-black text-accent tabular-nums leading-none">{playbackSpeed.toFixed(2)}x</span>
                  <button
                    onClick={() => setPlaybackSpeed(1.0)}
                    className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle text-text-muted hover:text-accent hover:border-accent transition-all active:scale-90"
                  >
                    <RotateCcw size={10} />
                  </button>
                </div>
              </div>
              <div className="space-y-6">
                <ThemedSlider
                  min={0.5}
                  max={2.0}
                  step={0.05}
                  value={playbackSpeed}
                  onChange={setPlaybackSpeed}
                />
                <div className="flex justify-between gap-2">
                  {[0.5, 1.0, 2.0].map((v) => (
                    <button
                      key={v}
                      onClick={() => setPlaybackSpeed(v)}
                      className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${Math.abs(playbackSpeed - v) < 0.01
                        ? "bg-accent text-black border-accent"
                        : "bg-white/5 text-text-muted border-white/5 hover:bg-white/10"
                        }`}
                    >
                      {v === 1.0 ? "Normal" : `${v}x`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Volume Booster Card */}
            <div className="glass rounded-[2rem] p-8 border border-border-subtle space-y-8 group hover:border-accent/20 transition-all shadow-xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent">
                    <Headphones size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">Volume Booster</h3>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium">main-gain multiplier</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-2xl font-black text-accent tabular-nums leading-none">{(volumeBoost * 100).toFixed(0)}%</span>
                  <button
                    onClick={() => setVolumeBoost(1.0)}
                    className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle text-text-muted hover:text-accent hover:border-accent transition-all active:scale-90"
                  >
                    <RotateCcw size={10} />
                  </button>
                </div>
              </div>
              <ThemedSlider
                min={1.0}
                max={2.0}
                step={0.05}
                value={volumeBoost}
                onChange={setVolumeBoost}
              />
            </div>

          </div>

          <div className="flex justify-center gap-8 text-[10px] font-black text-text-muted uppercase tracking-[0.3em] py-8 opacity-30">
            <span>Optimized Engine</span>
            <span>Bit-Perfect Path</span>
          </div>
        </div>
      </div>
    </div>
  );
}
