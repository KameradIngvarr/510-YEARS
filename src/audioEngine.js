const SFX_FILES = {
  stepMetal: [
    '../assets/sfx/step_metal_01.wav',
    '../assets/sfx/step_metal_02.wav',
    '../assets/sfx/step_metal_03.wav',
    '../assets/sfx/step_metal_04.wav'
  ],
  stepArmor: [
    '../assets/sfx/step_armor_01.wav',
    '../assets/sfx/step_armor_02.wav',
    '../assets/sfx/step_armor_03.wav',
    '../assets/sfx/step_armor_04.wav'
  ],
  land: [
    '../assets/sfx/land_01.wav',
    '../assets/sfx/land_02.wav'
  ],
  gaussFire: ['../assets/sfx/gauss_fire.wav'],
  laserFire: ['../assets/sfx/laser_fire_01.wav', '../assets/sfx/laser_fire_02.wav'],
  plasmaFire: ['../assets/sfx/plasma_fire_01.wav', '../assets/sfx/plasma_fire_02.wav'],
  reloadOut: ['../assets/sfx/rifle_reload_out.wav', '../assets/sfx/gauss_reload_1.wav'],
  reloadIn: ['../assets/sfx/rifle_reload_in.wav'],
  reloadChamber: ['../assets/sfx/rifle_reload_chamber.wav', '../assets/sfx/gauss_reload_2.wav'],
  laserReloadOut: ['../assets/sfx/laser_reload_1.wav'],
  laserReloadIn: ['../assets/sfx/laser_reload_2.wav'],
  laserReloadChamber: ['../assets/sfx/laser_reload_3.wav'],
  plasmaReloadOut: ['../assets/sfx/plasma_reload_1.wav'],
  plasmaReloadIn: ['../assets/sfx/plasma_reload_2.wav'],
  plasmaReloadChamber: ['../assets/sfx/plasma_reload_3.wav']
};

export class EnclaveAudio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.weaponType = 'gauss';
    this.masterGain = null;
    this.sfxGain = null;
    this.currentVoice = null;
    this.currentRadio = null;
    this.masterVolume = 1.0;
    this.voiceVolume = 0.85;
    this.radioVolume = 0.50;
    this.sfxVolume = 0.80;
    this.buffers = new Map();
    this.loadingBuffers = false;
  }

  ensureContext() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.28 * this.sfxVolume;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.ctx.destination);

      this.preloadBuffers();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  async preloadBuffers() {
    if (this.loadingBuffers || !this.ctx) return;
    this.loadingBuffers = true;
    const allUrls = new Set(Object.values(SFX_FILES).flat());
    for (const url of allUrls) {
      if (this.buffers.has(url)) continue;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const arr = await res.arrayBuffer();
        const decoded = await this.ctx.decodeAudioData(arr);
        this.buffers.set(url, decoded);
      } catch {}
    }
  }

  playSfxFile(list, gainMul = 1.0, rateJitter = 0.05) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !list || list.length === 0) return false;
    const src = list[Math.floor(Math.random() * list.length)];
    const buf = this.buffers.get(src);
    if (!buf) return false;

    const source = ctx.createBufferSource();
    source.buffer = buf;
    if (rateJitter > 0) {
      source.playbackRate.value = 1 + (Math.random() * 2 - 1) * rateJitter;
    }
    const g = ctx.createGain();
    g.gain.value = gainMul;
    source.connect(g);
    g.connect(this.sfxGain);
    source.start(0);
    return true;
  }

  updateVolumes() {
    const active = this.enabled;
    const master = Math.max(0, Math.min(1, this.masterVolume));
    if (this.currentVoice) {
      this.currentVoice.volume = active ? Math.max(0, Math.min(1, this.voiceVolume * master)) : 0;
    }
    if (this.currentRadio) {
      const duck = this.currentVoice ? 0.24 : 1.0;
      this.currentRadio.volume = active ? Math.max(0, Math.min(1, this.radioVolume * master * duck)) : 0;
    }
    if (this.ctx) {
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(active ? 0.28 * this.sfxVolume * master : 0, this.ctx.currentTime, 0.03);
      }
      if (this.sfxGain) {
        this.sfxGain.gain.setTargetAtTime(active ? this.sfxVolume * master : 0, this.ctx.currentTime, 0.03);
      }
    }
  }

  setMasterVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, Number(val)));
    this.updateVolumes();
  }

  setVoiceVolume(val) {
    this.voiceVolume = Math.max(0, Math.min(1, Number(val)));
    this.updateVolumes();
  }

  setRadioVolume(val) {
    this.radioVolume = Math.max(0, Math.min(1, Number(val)));
    this.updateVolumes();
  }

  setSfxVolume(val) {
    this.sfxVolume = Math.max(0, Math.min(1, Number(val)));
    this.updateVolumes();
  }

  setWeaponType(weaponId) {
    if (['gauss', 'laser', 'plasma'].includes(weaponId)) {
      this.weaponType = weaponId;
    }
  }

  setEnabled(val) {
    this.enabled = Boolean(val);
    if (!this.enabled) {
      this.stopVoice();
      this.stopRadio();
    }
    this.updateVolumes();
  }

  stopVoice() {
    if (this.currentVoice) {
      try {
        this.currentVoice.pause();
        this.currentVoice.currentTime = 0;
      } catch {}
      this.currentVoice = null;
      this.updateVolumes();
    }
  }

  playVoiceFile(src, onDuration, onEnded) {
    this.stopVoice();
    if (!this.enabled || !src) {
      if (onEnded) setTimeout(onEnded, 900);
      return null;
    }
    try {
      const el = new Audio(src);
      el.volume = Math.max(0, Math.min(1, this.voiceVolume * this.masterVolume));
      this.currentVoice = el;
      this.updateVolumes(); // Ducks radio softly while soldier/Dornan speaks
      el.addEventListener('loadedmetadata', () => {
        if (onDuration && Number.isFinite(el.duration) && el.duration > 0) {
          onDuration(el.duration);
        }
      }, { once: true });
      const clearVoice = () => {
        if (this.currentVoice === el) {
          this.currentVoice = null;
          this.updateVolumes();
          if (onEnded) onEnded();
        }
      };
      el.addEventListener('ended', clearVoice, { once: true });
      el.addEventListener('error', clearVoice, { once: true });
      el.play().catch(clearVoice);
      return el;
    } catch {
      if (onEnded) setTimeout(onEnded, 900);
      return null;
    }
  }

  stopRadio() {
    if (this.currentRadio) {
      try {
        this.currentRadio.pause();
        this.currentRadio.currentTime = 0;
      } catch {}
      this.currentRadio = null;
    }
  }

  playRadioClip(src, onEnded) {
    this.stopRadio();
    if (!this.enabled || !src) return null;
    try {
      const el = new Audio(src);
      this.currentRadio = el;
      this.updateVolumes();
      const finish = () => {
        if (this.currentRadio === el) {
          this.currentRadio = null;
          if (onEnded) onEnded();
        }
      };
      el.addEventListener('ended', finish, { once: true });
      el.addEventListener('error', (e) => {
        console.warn('[RADIO_AUDIO_ERROR]', src, el.error?.code, el.error?.message || e?.message || '');
        finish();
      }, { once: true });
      el.play().catch((err) => {
        console.warn('[RADIO_PLAY_REJECTED]', src, err?.name, err?.message);
        finish();
      });
      return el;
    } catch {
      if (onEnded) onEnded();
      return null;
    }
  }

  createNoiseBuffer(ctx, durationSec) {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  playFootstep(volume = 0.55) {
    const playedMetal = this.playSfxFile(SFX_FILES.stepMetal, volume, 0.06);
    const playedArmor = this.playSfxFile(SFX_FILES.stepArmor, volume * 0.72, 0.06);
    if (playedMetal || playedArmor) return;

    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(105, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.11);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playLand() {
    const playedLand = this.playSfxFile(SFX_FILES.land, 0.78, 0.05);
    this.playSfxFile(SFX_FILES.stepArmor, 0.65, 0.05);
    if (playedLand) return;

    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.22);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(320, now);
    gain.gain.setValueAtTime(0.55, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  playReloadStep(step) {
    const w = this.weaponType;
    if (w === 'laser') {
      if (step === 'out') this.playSfxFile(SFX_FILES.laserReloadOut, 0.72, 0.04);
      else if (step === 'in') this.playSfxFile(SFX_FILES.laserReloadIn, 0.72, 0.04);
      else if (step === 'chamber') this.playSfxFile(SFX_FILES.laserReloadChamber, 0.74, 0.04);
      return;
    }
    if (w === 'plasma') {
      if (step === 'out') this.playSfxFile(SFX_FILES.plasmaReloadOut, 0.72, 0.04);
      else if (step === 'in') this.playSfxFile(SFX_FILES.plasmaReloadIn, 0.72, 0.04);
      else if (step === 'chamber') this.playSfxFile(SFX_FILES.plasmaReloadChamber, 0.74, 0.04);
      return;
    }
    if (step === 'out') this.playSfxFile(SFX_FILES.reloadOut, 0.68, 0.04);
    else if (step === 'in') this.playSfxFile(SFX_FILES.reloadIn, 0.68, 0.04);
    else if (step === 'chamber') this.playSfxFile(SFX_FILES.reloadChamber, 0.72, 0.04);
  }

  playServo() {
    if (this.playSfxFile(SFX_FILES.stepArmor, 0.36, 0.08)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.09);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playGaussCharge() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (this.weaponType === 'laser') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(620, now);
      osc.frequency.exponentialRampToValueAtTime(1480, now + 0.30);
    } else if (this.weaponType === 'plasma') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(420, now + 0.32);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.34);
    }
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.34);
    filter.Q.value = 4.5;
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.linearRampToValueAtTime(0.20, now + 0.30);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.37);
  }

  playGaussFire() {
    const list = this.weaponType === 'laser'
      ? SFX_FILES.laserFire
      : this.weaponType === 'plasma'
        ? SFX_FILES.plasmaFire
        : SFX_FILES.gaussFire;
    if (this.playSfxFile(list, 0.92, 0.03)) return;

    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1950, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.24);
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.28);
  }

  playRadioChirp() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 0.14);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2100, now);
    bp.Q.value = 2.5;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.18, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    noise.connect(bp);
    bp.connect(nGain);
    nGain.connect(this.masterGain);
    noise.start(now);
  }
}
