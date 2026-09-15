/**
 * Cosmic Strike - Procedural Web Audio Engine
 * Zero external dependencies. All audio is synthesized via the Web Audio API.
 */

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.isMuted = false;
    this.sfxVolume = 0.7;
    this.musicVolume = 0.35;
    this.musicInterval = null;
    this.isMusicPlaying = false;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      this.initialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported or blocked:", e);
    }
  }

  resume() {
    if (!this.initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (!this.initialized) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 1, now + 0.05);
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (!this.initialized) return;
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
  }

  setMusicVolume(val) {
    this.musicVolume = Math.max(0, Math.min(1, val));
    if (!this.initialized) return;
    this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
  }

  // --- SOUND EFFECTS ---

  playPlayerLaser(type = 'default') {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (type === 'rapid') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.08);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'spread') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.15);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.15);
    } else {
      // standard laser
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  }

  playEnemyLaser() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.14);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playExplosion(type = 'medium') {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    const duration = type === 'large' ? 0.8 : (type === 'boss' ? 1.6 : 0.35);
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    const startFreq = type === 'boss' ? 600 : (type === 'large' ? 800 : 1200);
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(30, now + duration);

    const gain = this.ctx.createGain();
    const peakGain = type === 'boss' ? 0.9 : (type === 'large' ? 0.6 : 0.4);
    gain.gain.setValueAtTime(peakGain, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + duration);

    // Sub-bass thump for large/boss explosions
    if (type === 'large' || type === 'boss') {
      const sub = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(120, now);
      sub.frequency.exponentialRampToValueAtTime(25, now + duration * 0.7);
      subGain.gain.setValueAtTime(0.6, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.7);

      sub.connect(subGain);
      subGain.connect(this.sfxGain);
      sub.start(now);
      sub.stop(now + duration * 0.7);
    }
  }

  playPowerup() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    const stepDuration = 0.06;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * stepDuration;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 1.5);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + stepDuration * 1.5);
    });
  }

  playShieldHit() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playBomb() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 1.2);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 1.2);
    this.playExplosion('large');
  }

  playBossAlert() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.45;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.linearRampToValueAtTime(480, t + 0.2);
      osc.frequency.linearRampToValueAtTime(240, t + 0.35);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.4);
    }
  }

  playGameOver() {
    if (!this.initialized || this.isMuted) return;
    const now = this.ctx.currentTime;
    const notes = [440, 415.3, 392, 349.23, 329.63, 261.63]; // A4 -> C4 sad drop
    const stepDuration = 0.18;

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const t = now + idx * stepDuration;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + stepDuration * 1.8);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + stepDuration * 1.8);
    });
  }

  // --- PROCEDURAL BACKGROUND SYNTH ARPEGGIO ---

  startMusic() {
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;
    if (!this.initialized) this.init();

    // Retro cyberpunk 16-step bassline & melody pattern in D-minor
    const scale = [
      146.83, // D3
      174.61, // F3
      220.00, // A3
      261.63, // C4
      293.66, // D4
      349.23, // F4
      392.00, // G4
      440.00  // A4
    ];

    const bassPattern = [146.83, 146.83, 130.81, 130.81, 116.54, 116.54, 130.81, 146.83];
    const arpeggio = [0, 2, 4, 7, 5, 3, 2, 4, 1, 3, 5, 4, 2, 4, 3, 1];

    let step = 0;
    const tempo = 135;
    const stepTime = (60 / tempo) / 2; // 16th notes ~111ms

    this.musicInterval = setInterval(() => {
      if (!this.initialized || this.isMuted || !this.isMusicPlaying) return;
      const now = this.ctx.currentTime;

      // Arpeggio Lead
      const noteIdx = arpeggio[step % arpeggio.length];
      const freq = scale[noteIdx % scale.length];

      const leadOsc = this.ctx.createOscillator();
      const leadGain = this.ctx.createGain();
      const leadFilter = this.ctx.createBiquadFilter();

      leadOsc.type = 'sawtooth';
      leadOsc.frequency.setValueAtTime(freq * 1.5, now);

      leadFilter.type = 'lowpass';
      leadFilter.frequency.setValueAtTime(1400 + Math.sin(step * 0.4) * 600, now);
      leadFilter.Q.setValueAtTime(4, now);

      leadGain.gain.setValueAtTime(0.08, now);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 0.9);

      leadOsc.connect(leadFilter);
      leadFilter.connect(leadGain);
      leadGain.connect(this.musicGain);

      leadOsc.start(now);
      leadOsc.stop(now + stepTime * 0.9);

      // Bass Pulse on every 2 steps
      if (step % 2 === 0) {
        const bassFreq = bassPattern[Math.floor(step / 2) % bassPattern.length] * 0.5;
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();

        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassFreq, now);

        bassGain.gain.setValueAtTime(0.18, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + stepTime * 1.6);

        bassOsc.connect(bassGain);
        bassGain.connect(this.musicGain);

        bassOsc.start(now);
        bassOsc.stop(now + stepTime * 1.6);
      }

      step++;
    }, stepTime * 1000);
  }

  stopMusic() {
    this.isMusicPlaying = false;
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

// Global Audio Singleton
window.soundEngine = new SoundEngine();
