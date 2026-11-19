// audio.js — all sound is synthesized with WebAudio: no audio files.
// Engine hum, two-tone siren, gunshot, crash thud, pickup chime, UI click.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let sirenHigh = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch (error) {
      ctx = null;
      return false;
    }
    return true;
  }

  function noiseBuffer(duration) {
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  return {
    // Call from the first user gesture (Start button).
    unlock() {
      ensure();
    },
    startEngine() {
      if (!ensure() || engineOsc) return;
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0.0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
    },
    setEngine(speedNorm, driving) {
      if (!engineOsc) return;
      const target = driving ? 0.05 + speedNorm * 0.11 : 0.0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + speedNorm * 130, ctx.currentTime, 0.08);
    },
    setSiren(on) {
      if (on && !sirenOsc) {
        if (!ensure()) return;
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'square';
        sirenOsc.frequency.value = 720;
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
        sirenTimer = setInterval(() => {
          sirenHigh = !sirenHigh;
          if (sirenOsc) sirenOsc.frequency.setTargetAtTime(sirenHigh ? 720 : 540, ctx.currentTime, 0.02);
        }, 320);
      } else if (!on && sirenOsc) {
        clearInterval(sirenTimer);
        sirenTimer = null;
        try { sirenOsc.stop(); } catch (error) {}
        sirenOsc.disconnect();
        sirenGain.disconnect();
        sirenOsc = null;
        sirenGain = null;
      }
    },
    gunshot() {
      if (!ensure()) return;
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(0.16);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2400;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    },
    crash() {
      if (!ensure()) return;
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(0.3);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    },
    pickup() {
      if (!ensure()) return;
      const now = ctx.currentTime;
      [660, 990].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.22, now + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.18);
        osc.connect(gain);
        gain.connect(master);
        osc.start(now + i * 0.09);
        osc.stop(now + i * 0.09 + 0.2);
      });
    },
    click() {
      if (!ensure()) return;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = 880;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    },
    skid() {
      if (!ensure()) return;
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer(0.4);
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 900;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    },
  };
}
