import { useStore } from "../store";

let audioInstance: HTMLAudioElement;
let audioCtx: AudioContext | null = null;
let source: MediaElementAudioSourceNode | null = null;

let bassFilter: BiquadFilterNode | null = null;
let reverbNode: ConvolverNode | null = null;
let dryGain: GainNode | null = null;
let wetGain: GainNode | null = null;
let boostGain: GainNode | null = null;
let masterGain: GainNode | null = null;
let eqFilters: BiquadFilterNode[] = [];

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

let impulseBuffer: AudioBuffer | null = null;

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
        setTimeout(appendAudio, 100);
      }
    };
    appendAudio();
  }

  // Smoothly ramp master gain on pause/play to avoid clicks
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
  console.error("AudioEngine: Global initialization failed", err);
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

function createImpulseResponse(context: BaseAudioContext, duration: number, decay: number) {
  const sampleRate = context.sampleRate;
  const length = sampleRate * duration;
  const impulse = context.createBuffer(2, length, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return impulse;
}

export function initAudioContext() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    return;
  }

  try {
    const ContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    if (!ContextClass) return;
    audioCtx = new ContextClass();

    impulseBuffer = createImpulseResponse(audioCtx, 2.5, 2.5);
    source = audioCtx.createMediaElementSource(audio);

    bassFilter = audioCtx.createBiquadFilter();
    bassFilter.type = "lowshelf";
    bassFilter.frequency.value = 200;

    dryGain = audioCtx.createGain();
    wetGain = audioCtx.createGain();
    reverbNode = audioCtx.createConvolver();
    reverbNode.buffer = impulseBuffer;

    boostGain = audioCtx.createGain();
    masterGain = audioCtx.createGain();

    // Frequencies are clamped below Nyquist to avoid crashes on low-rate headsets (e.g. HSP/HFP at 8kHz)
    eqFilters = EQ_FREQUENCIES.map(() => {
      const filter = audioCtx!.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = 0;
      filter.Q.value = 1.4;
      filter.gain.value = 0;
      return filter;
    });

    // Apply clamped frequencies after creation
    const nyquist = audioCtx.sampleRate / 2;
    EQ_FREQUENCIES.forEach((freq, i) => {
      eqFilters[i].frequency.value = Math.min(freq, nyquist * 0.9);
    });

    source.connect(eqFilters[0]);
    for (let i = 0; i < eqFilters.length - 1; i++) {
      eqFilters[i].connect(eqFilters[i + 1]);
    }
    eqFilters[eqFilters.length - 1].connect(bassFilter);

    bassFilter.connect(dryGain);
    bassFilter.connect(reverbNode);
    reverbNode.connect(wetGain);
    dryGain.connect(boostGain);
    wetGain.connect(boostGain);
    boostGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);

    // Resume automatically after device switches (e.g. Bluetooth reconnect)
    audioCtx.addEventListener("statechange", () => {
      if (audioCtx?.state === "suspended" || audioCtx?.state === "interrupted") {
        audioCtx.resume().catch(() => {});
      }
    });

    syncEngineState();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (err) {
    console.error("AudioEngine: Web Audio init failed", err);
  }
}

function syncEngineState() {
  if (!audioCtx || !source) return;
  const now = audioCtx.currentTime;

  // When the Web Audio graph is active, the element's volume is locked at 1
  // and we drive levels through the gain nodes instead
  if (audio) audio.volume = 1.0;

  if (bassFilter) {
    bassFilter.gain.cancelScheduledValues(now);
    bassFilter.gain.setTargetAtTime(currentBassBoost, now, 0.01);
  }
  if (boostGain) {
    boostGain.gain.cancelScheduledValues(now);
    boostGain.gain.setTargetAtTime(currentVolumeBoost, now, 0.01);
  }
  if (masterGain) {
    masterGain.gain.cancelScheduledValues(now);
    const targetVol = audio?.paused ? 0.0001 : currentVolume;
    masterGain.gain.setTargetAtTime(targetVol, now, 0.01);
  }
  if (dryGain && wetGain) {
    dryGain.gain.cancelScheduledValues(now);
    dryGain.gain.setTargetAtTime(currentReverbEnabled ? 0.6 : 1.0, now, 0.01);
    wetGain.gain.cancelScheduledValues(now);
    wetGain.gain.setTargetAtTime(currentReverbEnabled ? currentReverbStrength : 0.0, now, 0.01);
  }
}

// In low-end mode we bypass the convolver (expensive FFT) by silencing the wet path,
// and we widen the EQ smoothing constant so individual band updates are less frequent.
export function setLowEndMode(enabled: boolean) {
  isLowEndMode = enabled;
  if (!audioCtx || !wetGain || !dryGain) return;

  const now = audioCtx.currentTime;
  if (enabled) {
    // Force wet gain to 0 regardless of reverb setting — convolver stays
    // in the graph but processes silence, which is still cheaper than
    // rebuilding the graph topology.
    wetGain.gain.cancelScheduledValues(now);
    wetGain.gain.setTargetAtTime(0, now, 0.01);
    // Widen EQ time constant so rapid band drags don't spam the audio thread
    eqFilters.forEach(f => f.gain.value = f.gain.value); // flush pending
  } else {
    // Restore reverb state
    syncEngineState();
  }
}

export function setEngineVolume(vol: number) {
  currentVolume = vol;
  if (audio) {
    if (audioCtx) {
      // Volume is controlled via masterGain when the Web Audio context is active
      audio.volume = 1.0;
    } else {
      audio.volume = vol;
    }
  }
  syncEngineState();
}

export function setReverbEnabled(enabled: boolean) {
  currentReverbEnabled = enabled;
  // In low-end mode the wet path stays at 0 regardless — don't override that.
  if (!isLowEndMode) syncEngineState();
}

export function setReverbStrength(strength: number) {
  currentReverbStrength = strength;
  syncEngineState();
}

export function setPlaybackSpeed(speed: number) {
  if (audio) audio.playbackRate = speed;
}

export function setEqGain(index: number, gain: number) {
  if (eqFilters[index] && audioCtx) {
    const now = audioCtx.currentTime;
    // Use a wider smoothing time in low-end mode to reduce audio thread pressure
    const smoothing = isLowEndMode ? 0.05 : 0.01;
    eqFilters[index].gain.cancelScheduledValues(now);
    eqFilters[index].gain.setTargetAtTime(gain, now, smoothing);
  }
}

export function setBassBoost(db: number) {
  currentBassBoost = db;
  syncEngineState();
}

export function setVolumeBoost(multiplier: number) {
  currentVolumeBoost = multiplier;
  syncEngineState();
}

if (typeof document !== "undefined") {
  document.addEventListener("click", () => {
    if (!useStore.getState().safeAudioMode) {
      initAudioContext();
    } else if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  });
}
