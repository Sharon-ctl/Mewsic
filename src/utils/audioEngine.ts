import { useStore } from "../store";

let audioInstance: HTMLAudioElement;
let audioCtx: AudioContext | null = null;
let source: MediaElementAudioSourceNode | null = null;

let eqFilters: BiquadFilterNode[] = [];
let bassFilter: BiquadFilterNode | null = null;
let reverbNode: ConvolverNode | null = null;
let dryGain: GainNode | null = null;
let wetGain: GainNode | null = null;
let boostGain: GainNode | null = null;
let masterGain: GainNode | null = null;

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

let currentBassBoost = 0;
let currentVolumeBoost = 1.0;
let currentReverbEnabled = false;
let currentReverbStrength = 0.5;
let currentVolume = 1.0;
let isLowEndMode = false;

try {
  audioInstance = new Audio();
  audioInstance.preload = "auto";
  audioInstance.style.display = "none";
  audioInstance.crossOrigin = "anonymous";

  if (typeof document !== "undefined") {
    const appendAudio = () => {
      if (document.body) {
        document.body.appendChild(audioInstance);
      } else {
        setTimeout(appendAudio, 50);
      }
    };
    appendAudio();
  }

  // ramp masterGain on pause/play to avoid clicks when the Web Audio graph is active
  audioInstance.addEventListener("pause", () => {
    if (audioCtx && masterGain) {
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.02);
    }
  });
  audioInstance.addEventListener("play", () => {
    if (audioCtx && masterGain) {
      masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
      masterGain.gain.setTargetAtTime(currentVolume, audioCtx.currentTime, 0.02);
    }
  });
} catch (err) {
  console.error("AudioEngine: failed to create audio element", err);
  audioInstance = {
    play: () => Promise.resolve(),
    pause: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    setAttribute: () => {},
    removeAttribute: () => {},
    playbackRate: 1.0,
    volume: 1.0,
  } as any;
}

export const audio = audioInstance;

function createImpulseResponse(ctx: BaseAudioContext, duration: number, decay: number): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * duration;
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

// cancelScheduledValues is required before setTargetAtTime to avoid
// "start time before end of previous event" errors on long-running contexts
function safeSetGain(param: AudioParam, value: number, ctx: AudioContext) {
  param.cancelScheduledValues(ctx.currentTime);
  param.setTargetAtTime(value, ctx.currentTime, 0.01);
}

// full sync — only called once during graph init
function syncEngineState() {
  if (!audioCtx || !source) return;

  // when the web audio graph is active, the element volume must stay at 1
  // otherwise you get double attenuation (element × masterGain)
  audioInstance.volume = 1.0;

  if (bassFilter) safeSetGain(bassFilter.gain, currentBassBoost, audioCtx);
  if (boostGain) safeSetGain(boostGain.gain, currentVolumeBoost, audioCtx);
  if (masterGain) safeSetGain(masterGain.gain, currentVolume, audioCtx);
  syncReverb();
  syncEqConnections();
}

// targeted update for just the wet/dry path — avoids touching bass/boost/master unnecessarily
// We also dynamically connect/disconnect the reverbNode to stop convolver processing (FFT is expensive)
function syncReverb() {
  if (!audioCtx || !dryGain || !wetGain || !reverbNode || !bassFilter) return;
  const reverbActive = currentReverbEnabled && !isLowEndMode;

  try {
    bassFilter.disconnect(reverbNode);
  } catch (_) {}

  if (reverbActive) {
    try {
      bassFilter.connect(reverbNode);
    } catch (_) {}
    safeSetGain(dryGain.gain, 0.6, audioCtx);
    safeSetGain(wetGain.gain, currentReverbStrength, audioCtx);
  } else {
    safeSetGain(dryGain.gain, 1.0, audioCtx);
    safeSetGain(wetGain.gain, 0.0, audioCtx);
  }
}

// Bypasses the 10 peaking EQ filters completely when flat (gains = 0) or in low-end mode to save audio thread CPU
function syncEqConnections() {
  if (!audioCtx || !source || !bassFilter) return;

  const state = useStore.getState();
  const eqGains = state.eqGains || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const eqActive = !isLowEndMode && eqGains.some((g) => g !== 0);

  try {
    source.disconnect();
  } catch (_) {}

  if (eqActive) {
    // source -> EQ chain -> bassFilter
    source.connect(eqFilters[0]);
    for (let i = 0; i < eqFilters.length - 1; i++) {
      try {
        eqFilters[i].disconnect();
      } catch (_) {}
      eqFilters[i].connect(eqFilters[i + 1]);
    }
    try {
      eqFilters[eqFilters.length - 1].disconnect();
    } catch (_) {}
    eqFilters[eqFilters.length - 1].connect(bassFilter);
  } else {
    // Bypassed: source -> bassFilter directly
    source.connect(bassFilter);
  }
}

export function initAudioContext() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    return;
  }

  try {
    const ContextClass: typeof AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!ContextClass) return;

    audioCtx = new ContextClass();
    const nyquist = audioCtx.sampleRate / 2;

    source = audioCtx.createMediaElementSource(audio);

    // 10-band EQ — frequencies clamped below nyquist to avoid crashes on
    // bluetooth headsets running at 8kHz (HSP/HFP profile)
    eqFilters = EQ_FREQUENCIES.map((freq) => {
      const f = audioCtx!.createBiquadFilter();
      f.type = "peaking";
      f.frequency.value = Math.min(freq, nyquist * 0.9);
      f.Q.value = 1.4;
      f.gain.value = 0;
      return f;
    });

    bassFilter = audioCtx.createBiquadFilter();
    bassFilter.type = "lowshelf";
    bassFilter.frequency.value = 200;

    const impulseBuffer = createImpulseResponse(audioCtx, 2.5, 2.5);
    reverbNode = audioCtx.createConvolver();
    reverbNode.buffer = impulseBuffer;
    dryGain = audioCtx.createGain();
    wetGain = audioCtx.createGain();

    boostGain = audioCtx.createGain();
    masterGain = audioCtx.createGain();

    // Setup initial connection topologies
    bassFilter.connect(dryGain);
    reverbNode.connect(wetGain);
    dryGain.connect(boostGain);
    wetGain.connect(boostGain);
    boostGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    syncEngineState();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  } catch (err) {
    console.error("AudioEngine: web audio init failed", err);
    audioCtx = null;
  }
}

export function setEngineVolume(vol: number) {
  currentVolume = Math.max(0, Math.min(1, vol));
  if (audioCtx && masterGain) {
    safeSetGain(masterGain.gain, currentVolume, audioCtx);
    audioInstance.volume = 1.0;
  } else {
    audioInstance.volume = currentVolume;
  }
}

export function setReverbEnabled(enabled: boolean) {
  currentReverbEnabled = enabled;
  syncReverb();
}

export function setReverbStrength(strength: number) {
  currentReverbStrength = strength;
  syncReverb();
}

export function setPlaybackSpeed(speed: number) {
  audioInstance.playbackRate = Math.max(0.25, Math.min(4.0, speed));
}

export function setBassBoost(db: number) {
  currentBassBoost = db;
  if (bassFilter && audioCtx) safeSetGain(bassFilter.gain, currentBassBoost, audioCtx);
}

export function setVolumeBoost(multiplier: number) {
  currentVolumeBoost = Math.max(0, multiplier);
  if (boostGain && audioCtx) safeSetGain(boostGain.gain, currentVolumeBoost, audioCtx);
}

export function setEqGain(index: number, gain: number) {
  if (!eqFilters[index] || !audioCtx) return;
  // wider smoothing in low-end mode to reduce audio thread pressure from rapid EQ drags
  const smoothing = isLowEndMode ? 0.05 : 0.01;
  eqFilters[index].gain.cancelScheduledValues(audioCtx.currentTime);
  eqFilters[index].gain.setTargetAtTime(gain, audioCtx.currentTime, smoothing);
  syncEqConnections();
}

export function setLowEndMode(enabled: boolean) {
  isLowEndMode = enabled;
  syncReverb();
  syncEqConnections();
}

if (typeof document !== "undefined") {
  document.addEventListener(
    "click",
    () => {
      if (!useStore.getState().safeAudioMode) {
        initAudioContext();
      } else if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
    },
    { capture: true }
  );
}
