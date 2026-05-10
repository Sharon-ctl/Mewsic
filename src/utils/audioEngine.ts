/**
 * utils/audioEngine.ts
 * -------------------
 * Global singleton for the audio engine and Web Audio API integration.
 */

let audioInstance: HTMLAudioElement;
let audioCtx: AudioContext | null = null;
let source: MediaElementAudioSourceNode | null = null;

// Nodes
let bassFilter: BiquadFilterNode | null = null;
let reverbNode: ConvolverNode | null = null;
let dryGain: GainNode | null = null;
let wetGain: GainNode | null = null;
let boostGain: GainNode | null = null;
let masterGain: GainNode | null = null;
let limiter: DynamicsCompressorNode | null = null;
let eqFilters: BiquadFilterNode[] = [];
const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

// Pre-generated impulse response
let impulseBuffer: AudioBuffer | null = null;

// Internal state to sync with store
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

  // Instant Pause/Play optimization for DSP
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

/**
 * Creates a simple synthetic impulse response for reverb.
 */
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

    // Final Stage: Safety Limiter to prevent clipping ("chipping")
    limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-1.0, audioCtx.currentTime); // Start limiting just below 0dB
    limiter.knee.setValueAtTime(0, audioCtx.currentTime);        // Hard knee for limiting
    limiter.ratio.setValueAtTime(20, audioCtx.currentTime);      // High ratio for limiting
    limiter.attack.setValueAtTime(0.003, audioCtx.currentTime);  // Fast attack
    limiter.release.setValueAtTime(0.1, audioCtx.currentTime);   // Standard release
    
    // Create 10 EQ bands
    eqFilters = EQ_FREQUENCIES.map(freq => {
      const filter = audioCtx!.createBiquadFilter();
      filter.type = "peaking";
      filter.frequency.value = freq;
      filter.Q.value = 1.4; // Standard Q for 10-band EQ
      filter.gain.value = 0;
      return filter;
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
    masterGain.connect(limiter);
    limiter.connect(audioCtx.destination);
    
    syncEngineState();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (err) {
    console.error("AudioEngine: Web Audio init failed", err);
  }
}

function syncEngineState() {
  if (!audioCtx || !source) return;
  const now = audioCtx.currentTime;

  // Unified Engine: High-fidelity parameter updates
  if (audio) audio.volume = 1.0; 
  
  // Use cancelScheduledValues to clear any previous ramps, then smooth ramp to new value
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

export function setLowEndMode(enabled: boolean) {
  // Low-End mode now only affects UI/Access, engine stays unified for stability
  isLowEndMode = enabled;
}

export function setEngineVolume(vol: number) {
  currentVolume = vol;
  syncEngineState();
  if (audio) audio.volume = 1.0; 
}

export function setReverbEnabled(enabled: boolean) {
  currentReverbEnabled = enabled;
  syncEngineState();
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
    eqFilters[index].gain.cancelScheduledValues(now);
    eqFilters[index].gain.setTargetAtTime(gain, now, 0.01);
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

export function getAnalyser() { return null; }
export function getNormalizedFrequencyData() { return []; }
