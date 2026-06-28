import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  Zap,
  Sliders,
  AudioWaveform,
  Radio,
  Headphones,
  AlertTriangle,
  RotateCcw,
  Activity,
  Music,
  Trash2,
  Bookmark,
  Plus,
  Save,
  Pencil,
  MoreVertical
} from "lucide-react";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { ThemedSlider } from "../UI/ThemedSlider";
import { useSmoothScroll } from "../../hooks/useSmoothScroll";

export function AudioView() {
  const {
    volume, setVolume,
    reverbEnabled, setReverbEnabled,
    reverbStrength, setReverbStrength,
    bassBoost, setBassBoost,
    playbackSpeed, setPlaybackSpeed,
    volumeBoost, setVolumeBoost,
    resetAudioEffects,
    lowEndMode,
    safeAudioMode,
    setSafeAudioMode,
    isDevMode,
    eqGains,
    setEqGain,
    resetEq,
    audioPresets,
    activePresetId,
    renamePresetId,
    setRenamePresetId,
    applyPreset,
    savePreset,
    deletePreset,
    updatePresetName,
    updatePresetSettings,
    addNotification,
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
    resetAudioEffects: s.resetAudioEffects || (() => { }),
    eqGains: s.eqGains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    setEqGain: s.setEqGain || (() => { }),
    resetEq: s.resetEq || (() => { }),
    lowEndMode: !!s.lowEndMode,
    safeAudioMode: !!s.safeAudioMode,
    setSafeAudioMode: s.setSafeAudioMode,
    isDevMode: !!s.isDevMode,
    audioPresets: s.audioPresets || [],
    activePresetId: s.activePresetId,
    renamePresetId: s.renamePresetId,
    setRenamePresetId: s.setRenamePresetId,
    applyPreset: s.applyPreset,
    savePreset: s.savePreset,
    deletePreset: s.deletePreset,
    updatePresetName: s.updatePresetName,
    updatePresetSettings: s.updatePresetSettings,
    addNotification: s.addNotification,
  })));

  const [presetName, setPresetName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  useSmoothScroll(containerRef);

  const handleSavePreset = () => {
    if (!presetName.trim()) return;
    savePreset(presetName.trim());
    setPresetName("");
    setShowSaveDialog(false);
    addNotification?.("Preset created successfully", "success");
  };

  const handleRenamePreset = () => {
    if (!renameValue.trim() || !renamePresetId) return;
    updatePresetName(renamePresetId, renameValue.trim());
    setRenamePresetId(null);
    setRenameValue("");
    addNotification?.("Preset renamed successfully", "success");
  };

  useEffect(() => {
    if (renamePresetId) {
      const p = audioPresets.find(p => p.id === renamePresetId);
      if (p) setRenameValue(p.name);
    }
  }, [renamePresetId, audioPresets]);

  return (
    <div className="flex-1 flex flex-col h-full bg-surface-base text-text-primary overflow-hidden page">
      {/* Header */}
      <header className="p-4 md:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border-subtle bg-surface-base/50 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-muted flex items-center justify-center text-accent flex-shrink-0">
            <AudioWaveform size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">Mewsic Audio Engine</h1>
            <p className="text-xs md:text-sm text-text-muted truncate">V2 | Designed for high quality audio.</p>
          </div>
        </div>
        <button
          onClick={resetAudioEffects}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-red-500 transition-all active:scale-95 w-full sm:w-auto flex-shrink-0"
        >
          Reset Engine
        </button>
      </header>

      {/* Scrollable Content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">

          {lowEndMode && (
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15 flex items-center gap-4">
              <AlertTriangle size={18} className="text-amber-500 flex-shrink-0" />
              <p className="text-xs text-amber-500/80 font-medium leading-relaxed">
                <span className="font-bold">Low-End Mode is on.</span> Expensive effects like reverb may cause audio glitches on weak hardware.
              </p>
            </div>
          )}

          <section className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <Bookmark size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-xl tracking-tight">Audio Presets</h3>
                  <p className="text-[10px] text-text-muted uppercase tracking-[0.2em] font-black">Save & load custom profiles</p>
                </div>
              </div>
              <button
                onClick={() => setShowSaveDialog(true)}
                className="btn-accent h-10 px-4"
              >
                <Plus size={15} />
                <span>Create New Preset</span>
              </button>
            </div>

            {showSaveDialog && (
              <div className="glass rounded-[1.5rem] p-6 border border-accent/20 mb-8 animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                  <input
                    type="text"
                    placeholder="Enter preset name (e.g. Bass Boosted, Studio...)"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent/50 outline-none transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                    autoFocus
                  />
                  <div className="flex gap-2 w-full md:w-auto">
                    <button
                      onClick={handleSavePreset}
                      className="flex-1 md:flex-none btn-accent h-11 px-8"
                    >
                      Create
                    </button>
                    <button
                      onClick={() => setShowSaveDialog(false)}
                      className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {renamePresetId && (
              <div className="glass rounded-[1.5rem] p-6 border border-accent/20 mb-8 animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                  <input
                    type="text"
                    placeholder="New preset name..."
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-accent/50 outline-none transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && handleRenamePreset()}
                    autoFocus
                  />
                  <div className="flex gap-2 w-full md:w-auto">
                    <button
                      onClick={handleRenamePreset}
                      className="flex-1 md:flex-none btn-accent h-11 px-8"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        setRenamePresetId(null);
                      }}
                      className="flex-1 md:flex-none px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {audioPresets.map((preset) => (
                <div
                  key={preset.id}
                  data-preset-id={preset.id}
                  data-context="audio-preset"
                  onClick={() => applyPreset(preset.id)}
                  className={`group relative p-5 rounded-[1.5rem] border transition-all cursor-pointer ${activePresetId === preset.id
                    ? 'bg-accent/10 border-accent/30 shadow-lg shadow-accent/5'
                    : 'bg-white/5 border-white/5 hover:border-white/20 hover:bg-white/[0.07]'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${activePresetId === preset.id ? 'bg-accent/20 text-accent' : 'bg-white/5 text-text-muted'}`}>
                      <Music size={14} />
                    </div>
                  </div>
                  <h4 className={`font-bold text-sm truncate ${activePresetId === preset.id ? 'text-accent' : 'text-text-primary'}`}>
                    {preset.name}
                  </h4>
                </div>
              ))}
            </div>
          </section>

          {/* Master Volume Card */}
          <section className="glass rounded-[2rem] p-10 border border-border-subtle relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
              <Volume2 size={320} className="text-accent" />
            </div>

            <div className="relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
                    <Volume2 size={28} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">Volume</h2>
                    <p className="text-[10px] sm:text-xs text-text-muted uppercase tracking-widest font-medium">primary gain controller</p>
                  </div>
                </div>
                <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-start gap-2 border-t border-white/5 sm:border-0 pt-4 sm:pt-0">
                  <div className="text-4xl sm:text-5xl font-black text-accent tracking-tighter tabular-nums leading-none">
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
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent flex-shrink-0">
                    <Zap size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base truncate">Reverberation</h3>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium truncate">software reverb</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <button
                    onClick={() => {
                      setReverbEnabled(false);
                      setReverbStrength(0.5);
                    }}
                    className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle text-text-muted hover:text-accent hover:border-accent transition-all active:scale-90 flex-shrink-0"
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
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent flex-shrink-0">
                    <Radio size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base truncate">Bass Boost</h3>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium truncate">higher bass</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span className="text-xl font-black text-accent tabular-nums leading-none">+{bassBoost}dB</span>
                  <button
                    onClick={() => setBassBoost(0)}
                    className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle text-text-muted hover:text-accent hover:border-accent transition-all active:scale-90 flex-shrink-0"
                  >
                    <RotateCcw size={12} />
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
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent flex-shrink-0">
                    <Sliders size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base truncate">Playback Speed</h3>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium truncate">Time-Stretching</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span className="text-xl font-black text-accent tabular-nums leading-none">{playbackSpeed.toFixed(2)}x</span>
                  <button
                    onClick={() => setPlaybackSpeed(1.0)}
                    className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle text-text-muted hover:text-accent hover:border-accent transition-all active:scale-90 flex-shrink-0"
                  >
                    <RotateCcw size={12} />
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
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-accent/5 flex items-center justify-center text-accent flex-shrink-0">
                    <Headphones size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base truncate">Volume Booster</h3>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest font-medium truncate">main-gain multiplier</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span className="text-xl font-black text-accent tabular-nums leading-none">{(volumeBoost * 100).toFixed(0)}%</span>
                  <button
                    onClick={() => setVolumeBoost(1.0)}
                    className="p-1.5 rounded-lg bg-surface-raised border border-border-subtle text-text-muted hover:text-accent hover:border-accent transition-all active:scale-90 flex-shrink-0"
                  >
                    <RotateCcw size={12} />
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

          {/* Equalizer Placeholder Card */}
          <section className="glass rounded-[2rem] p-8 border border-border-subtle relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
              <Activity size={80} />
            </div>
            <div className="flex items-center justify-between relative mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-xl tracking-tight">Parametric Equalizer</h3>
                  <p className={`text-[10px] uppercase tracking-[0.2em] font-black text-accent`}>
                    10-Band Graphic EQ
                  </p>
                </div>
              </div>
              <button
                onClick={resetEq}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-accent/10 border border-white/5 hover:border-accent/30 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95"
              >
                Reset to Flat
              </button>
            </div>

            <div className={`flex flex-col items-center justify-between h-52 border-2 border-transparent rounded-2xl bg-white/[0.02] p-6 text-center transition-all`}>
              <div className="w-full grid grid-cols-5 md:grid-cols-10 gap-4 h-full">
                {["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"].map((freq, i) => (
                  <div key={freq} className="flex flex-col items-center gap-4">
                    <div className="flex-1 relative w-full flex justify-center">
                      <div className="absolute inset-y-0 w-px bg-white/5" />
                      <input
                        type="range"
                        min="-12"
                        max="12"
                        step="0.5"
                        value={eqGains[i] ?? 0}
                        onChange={(e) => setEqGain(i, parseFloat(e.target.value))}
                        className="vertical-range h-full accent-accent cursor-ns-resize"
                        style={{ WebkitAppearance: 'slider-vertical' } as React.CSSProperties}
                      />
                    </div>
                    <div className="text-center">
                      <p className={`text-[10px] font-bold tabular-nums ${(eqGains[i] ?? 0) !== 0 ? 'text-accent' : 'text-text-primary'}`}>
                        {(eqGains[i] ?? 0) > 0 ? `+${eqGains[i]}` : (eqGains[i] ?? 0)}
                      </p>
                      <p className="text-[9px] text-text-muted font-black uppercase tracking-tighter opacity-60">{freq}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Safe Audio Mode Toggle (Condensed) */}
          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-between gap-4 mt-8">
            <div className="flex items-center gap-4 min-w-0">
              <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-amber-500">Safe Audio / Direct Mode</h4>
                <p className="text-xs text-text-muted truncate">
                  Bypasses advanced DSP (EQ/Reverb) to fix Bluetooth headset crashes.
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={safeAudioMode}
                onChange={() => setSafeAudioMode(!safeAudioMode)}
              />
              <div className="w-9 h-5 bg-surface-raised rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 border border-border-subtle" />
            </label>
          </div>

          <div className="flex justify-center gap-8 text-[10px] font-black text-text-muted uppercase tracking-[0.3em] py-8 opacity-30">
            <span>Mewsic Audio Engine</span>
            <span>Absolute control over audio</span>
            <span>Engineered by xeoniii.dev</span>
          </div>
        </div>
      </div>
    </div>
  );
}
