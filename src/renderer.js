import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildEnclaveRig, attachWeaponToRig } from './rigBuilder.js';
import { EnclaveAnimator } from './animator.js';
import { EnclaveAudio } from './audioEngine.js';
import { ALL_DORNAN_PHRASES, pickDornanPhrase } from './dornanPhrases.js';
import { OUTPOST_LOOKUP, pickOutpostPhrase } from './enclaveOutpostPhrases.js';
import { EDEN_SPEECHES, ENCLAVE_RADIO_MUSIC } from './enclaveRadioData.js';

const ALL_DORNAN_LOOKUP = new Map(ALL_DORNAN_PHRASES.map((p) => [p.id, p]));

const ARMOR_MODELS = {
  remnants: {
    path: '../assets/models/remnants_power_armor.glb',
    label: 'Силовая броня Оставшихся (FNV)'
  },
  gannon: {
    path: '../assets/models/gannon_tesla_armor.glb',
    label: 'Броня семьи Гэннонов Тесла (FNV)'
  },
  enclave_fo3: {
    path: '../assets/models/enclave_fo3_armor.glb',
    label: 'Броня Анклава Mk II (FO3)'
  }
};

const WEAPON_MODELS = {
  gauss: {
    path: '../assets/models/weapons/gauss_rifle.glb',
    label: 'Гаусс-винтовка'
  },
  laser: {
    path: '../assets/models/weapons/laser_rifle.glb',
    label: 'Лазерная винтовка'
  },
  plasma: {
    path: '../assets/models/weapons/plasma_rifle.glb',
    label: 'Плазменная винтовка'
  }
};

const ENCLAVE_LINES = [
  'БОЕЦ АНКЛАВА НА ПОСТУ. СЕКТОР ЧИСТ.',
  'СИЛОВАЯ БРОНЯ MK II: РЕАКТОР В НОРМЕ (99%).',
  'ГАУСС-ВИНТОВКА ЗАРЯЖЕНА И ГОТОВА К БОЮ.',
  'БОЖЕ, ХРАНИ АНКЛАВ. БОЖЕ, ХРАНИ ПУСТОШЬ.',
  'ОБНАРУЖЕН ОПЕРАТОР ТЕРМИНАЛА. ЖДУ ПРИКАЗОВ.',
  'ПРОТОКОЛ НАБЛЮДЕНИЯ АКТИВЕН.',
  'ИДЁТ СКАНИРОВАНИЕ РАБОЧЕГО СТОЛА...',
  'ПЕРЕДАЧА НАВАРРО-ЦЕНТРУ: ВСЁ СПОКОЙНО.',
  'ОГНЕВАЯ МОЩЬ АНКЛАВА К ВАШИМ УСЛУГАМ.',
  'АКТИВИРОВАНА СИСТЕМА СЛЕЖЕНИЯ ЗА ЦЕЛЬЮ.'
];

const ENCLAVE_EXECUTE_LINES = [
  'ОБНАРУЖЕН НАРУШИТЕЛЬ ПЕРИМЕТРА. ОТКРЫВАЮ ОГОНЬ!',
  'ЦЕЛЬ ПОДТВЕРЖДЕНА. ПРОТОКОЛ УНИЧТОЖЕНИЯ!',
  'НЕСАНКЦИОНИРОВАННЫЙ ДОСТУП. ЛИКВИДАЦИЯ!'
];

const SLEEP_LINES = [
  'ПЕРЕХОД В РЕЖИМ ЭНЕРГОСБЕРЕЖЕНИЯ...',
  'РЕАКТОР MK II В ОЖИДАНИИ. ПОКА, ГРАЖДАНИН.'
];

const canvas = document.getElementById('viewport');
const speechBubble = document.getElementById('speech-bubble');
const speechText = document.getElementById('speech-text');
const loaderEl = document.getElementById('loader');
const contextMenu = document.getElementById('context-menu');

const audio = new EnclaveAudio();

const state = {
  patrol: true,
  gravity: true,
  sound: true,
  sleeping: false,
  autoStart: false,
  eyebotEnabled: true,
  masterVolume: 1.0,
  voiceVolume: 0.85,
  radioVolume: 0.50,
  sfxVolume: 0.80,
  voiceMode: 'sergeant',
  armorModel: 'remnants',
  weaponModel: 'gauss',
  autoFireTimer: 16 + Math.random() * 12,
  scale: 1.0,
  dragging: false,
  falling: false,
  fallVy: 0,
  menuOpen: false,
  ignoreMouse: true,
  lastClickTime: 0,
  speechTimer: null,
  patrolMode: 'guard', // 'guard' | 'walk'
  patrolTimer: 4.0,
  patrolDir: -1,
  cursorScreenX: 0,
  cursorScreenY: 0,
  winBounds: { x: 0, y: 0, width: 460, height: 480 },
  workArea: { x: 0, y: 0, width: 1920, height: 1040 }
};

// --- Three.js Setup ---
const renderer = new THREE.WebGLRenderer({
  canvas,
  alpha: true,
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();

const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex;

// Framed with generous side margin (so the Gauss rifle never clips when turning right)
// and ~110px headroom above the helmet for the Enclave CRT speech bubble.
const camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.1, 30);
camera.position.set(0, 1.32, 5.45);
camera.lookAt(0, 1.24, 0);

// Dramatic Fallout lighting (warm front key + cool wasteland rim + back reactor light)
const hemiLight = new THREE.HemisphereLight(0xcbe0ff, 0x3b2c1d, 0.85);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xffe7c2, 2.2);
keyLight.position.set(2.4, 3.6, 3.2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.5;
keyLight.shadow.camera.far = 12;
keyLight.shadow.camera.left = -1.6;
keyLight.shadow.camera.right = 1.6;
keyLight.shadow.camera.top = 2.6;
keyLight.shadow.camera.bottom = -0.4;
keyLight.shadow.bias = -0.0008;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x76b7ff, 1.45);
rimLight.position.set(-2.8, 2.2, -2.5);
scene.add(rimLight);

const reactorLight = new THREE.PointLight(0xff7e1a, 1.4, 2.4);
reactorLight.position.set(0, 1.25, -0.45);
scene.add(reactorLight);

// Soft ground shadow disc under boots
function createContactShadow() {
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(shadowCanvas);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.86), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.004;
  return mesh;
}
const contactShadow = createContactShadow();
scene.add(contactShadow);

// --- Gauss Rifle VFX System ---
const vfxGroup = new THREE.Group();
scene.add(vfxGroup);

const muzzleLight = new THREE.PointLight(0x4be7ff, 0, 4.5);
scene.add(muzzleLight);

const activeVfx = [];

function spawnGaussShot(rig) {
  rig.group.updateMatrixWorld(true);
  const muzzlePos = new THREE.Vector3();
  const targetPos = new THREE.Vector3();
  rig.muzzleAnchor.getWorldPosition(muzzlePos);
  rig.muzzleTarget.getWorldPosition(targetPos);

  const forwardDir = targetPos.sub(muzzlePos).normalize();
  const wType = state.weaponModel || 'gauss';

  const palette = wType === 'laser'
    ? { flash: 0xff9b8a, beam: 0xff2626, ring: 0xff5a4a, sparkA: 0xff3b30, sparkB: 0xffd0a0, light: 0xff3a2a }
    : wType === 'plasma'
      ? { flash: 0x9cff9e, beam: 0x44ff55, ring: 0x62ff70, sparkA: 0x4dff5e, sparkB: 0xd2ff8a, light: 0x44ff55 }
      : { flash: 0xa8f5ff, beam: 0x5aeaff, ring: 0x80f0ff, sparkA: 0x9df6ff, sparkB: 0xffd27a, light: 0x4be7ff };

  muzzleLight.color.setHex(palette.light);

  // Muzzle flash core
  const flashMat = new THREE.MeshBasicMaterial({
    color: palette.flash,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const flashSphere = new THREE.Mesh(new THREE.SphereGeometry(0.10, 14, 14), flashMat);
  flashSphere.position.copy(muzzlePos);
  vfxGroup.add(flashSphere);
  activeVfx.push({ mesh: flashSphere, life: 0, maxLife: 0.16, type: 'flash' });

  if (wType === 'plasma') {
    // Glowing plasma bolt projectile flying along barrel vector
    const boltMat = new THREE.MeshBasicMaterial({
      color: palette.beam,
      transparent: true,
      opacity: 0.96,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), boltMat);
    bolt.position.copy(muzzlePos);
    vfxGroup.add(bolt);
    activeVfx.push({ mesh: bolt, life: 0, maxLife: 0.42, type: 'bolt', vel: forwardDir.clone().multiplyScalar(5.8) });
  } else {
    // Beam streak aligned strictly with barrel axis
    const beamLen = wType === 'laser' ? 2.15 : 1.65;
    const beamRadius = wType === 'laser' ? 0.015 : 0.022;
    const beamMat = new THREE.MeshBasicMaterial({
      color: palette.beam,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(beamRadius * 0.55, beamRadius, beamLen, 8), beamMat);
    beam.position.copy(muzzlePos).addScaledVector(forwardDir, beamLen * 0.5);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), forwardDir);
    vfxGroup.add(beam);
    activeVfx.push({ mesh: beam, life: 0, maxLife: wType === 'laser' ? 0.16 : 0.19, type: 'beam' });
  }

  // Shock rings
  for (let i = 0; i < 2; i++) {
    const ringMat = new THREE.MeshBasicMaterial({
      color: palette.ring,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.065, 20), ringMat);
    ring.position.copy(muzzlePos).addScaledVector(forwardDir, 0.12 + i * 0.25);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), forwardDir);
    vfxGroup.add(ring);
    activeVfx.push({ mesh: ring, life: 0, maxLife: 0.24, type: 'ring', vel: forwardDir.clone().multiplyScalar(1.4) });
  }

  // Sparks
  for (let i = 0; i < 10; i++) {
    const sparkMat = new THREE.MeshBasicMaterial({
      color: i % 2 === 0 ? palette.sparkA : palette.sparkB,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const spark = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.018), sparkMat);
    spark.position.copy(muzzlePos);
    const vel = forwardDir.clone().multiplyScalar(2.4 + Math.random() * 2.5);
    vel.x += (Math.random() - 0.5) * 2.2;
    vel.y += (Math.random() - 0.5) * 2.2;
    vel.z += (Math.random() - 0.5) * 1.4;
    vfxGroup.add(spark);
    activeVfx.push({ mesh: spark, life: 0, maxLife: 0.32, type: 'spark', vel });
  }

  muzzleLight.position.copy(muzzlePos);
  muzzleLight.intensity = 6.5;
}

function updateVfx(dt) {
  if (muzzleLight.intensity > 0.01) {
    muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 36);
  }
  for (let i = activeVfx.length - 1; i >= 0; i--) {
    const item = activeVfx[i];
    item.life += dt;
    const p = item.life / item.maxLife;
    if (p >= 1) {
      vfxGroup.remove(item.mesh);
      item.mesh.geometry.dispose();
      item.mesh.material.dispose();
      activeVfx.splice(i, 1);
      continue;
    }

    item.mesh.material.opacity = 1 - p;
    if (item.type === 'flash') {
      const s = 1 + p * 1.6;
      item.mesh.scale.set(s, s, s);
    } else if (item.type === 'beam') {
      item.mesh.scale.set(1 - p * 0.7, 1, 1 - p * 0.7);
    } else if (item.type === 'bolt') {
      item.mesh.position.addScaledVector(item.vel, dt);
      const s = 1 + Math.sin(p * Math.PI) * 0.35;
      item.mesh.scale.setScalar(s);
    } else if (item.type === 'ring') {
      const s = 1 + p * 3.0;
      item.mesh.scale.set(s, s, 1);
      item.mesh.position.addScaledVector(item.vel, dt);
    } else if (item.type === 'spark') {
      item.vel.y -= 5.0 * dt;
      item.mesh.position.addScaledVector(item.vel, dt);
    }
  }
}

// --- Speech Bubble & UI Helpers ---
let speechPageTimers = [];

function clearSpeechTimers() {
  if (state.speechTimer) {
    clearTimeout(state.speechTimer);
    state.speechTimer = null;
  }
  for (const t of speechPageTimers) clearTimeout(t);
  speechPageTimers = [];
}

function splitSpeechPages(text, maxChars = 135) {
  const clean = String(text || '').trim();
  if (clean.length <= maxChars) return [clean];

  const sentences = clean.split(/(?<=[.!?…])\s+/).filter(Boolean);
  const chunks = [];
  for (const sent of sentences) {
    if (sent.length <= maxChars) {
      chunks.push(sent);
    } else {
      // Split overly long sentence cleanly on word boundaries
      const words = sent.split(/\s+/);
      let cur = '';
      for (const w of words) {
        if (cur && (cur.length + 1 + w.length > maxChars)) {
          chunks.push(cur);
          cur = w;
        } else {
          cur = cur ? `${cur} ${w}` : w;
        }
      }
      if (cur) chunks.push(cur);
    }
  }

  const pages = [];
  let page = '';
  for (const ch of chunks) {
    if (page && (page.length + 1 + ch.length > maxChars)) {
      pages.push(page);
      page = ch;
    } else {
      page = page ? `${page} ${ch}` : ch;
    }
  }
  if (page) pages.push(page);
  return pages.length > 0 ? pages : [clean];
}

function showSpeech(text, duration = 4200, tag = '[РАДИО АНКЛАВА]', theme = '') {
  clearSpeechTimers();
  const pages = splitSpeechPages(text, 135);
  const tagEl = document.getElementById('speech-tag');
  speechBubble.classList.toggle('sergeant', theme === 'sergeant');
  speechBubble.classList.toggle('outpost', theme === 'outpost');
  speechBubble.classList.add('visible');

  if (pages.length === 1) {
    tagEl.textContent = tag;
    speechText.textContent = pages[0];
    state.speechTimer = setTimeout(() => {
      speechBubble.classList.remove('visible');
    }, duration);
    return;
  }

  const totalChars = pages.reduce((sum, p) => sum + p.length, 0) || 1;
  let elapsed = 0;
  pages.forEach((pageText, idx) => {
    const showPage = () => {
      tagEl.textContent = `${tag} [${idx + 1}/${pages.length}]`;
      speechText.textContent = pageText;
    };
    if (idx === 0) {
      showPage();
    } else {
      speechPageTimers.push(setTimeout(showPage, Math.round(elapsed)));
    }
    elapsed += duration * (pageText.length / totalChars);
  });

  state.speechTimer = setTimeout(() => {
    speechBubble.classList.remove('visible');
  }, duration);
}

let pendingShotTimer = null;

function executeShotNow() {
  if (!animator || state.dragging || state.sleeping) return;
  const w = state.weaponModel;
  if (w === 'laser') {
    animator.setFireBurst(Math.random() < 0.5 ? 3 : 4, 0.17, 0.28);
  } else if (w === 'plasma') {
    animator.setFireBurst(Math.random() < 0.5 ? 2 : 3, 0.24, 0.30);
  } else {
    animator.setFireBurst(1, 0.20, 0.34);
  }
  audio.playGaussCharge();
  animator.setState('fire');
}

function playPhraseClip(phrase, tag, theme, onSpeechComplete = null) {
  const baseMs = Math.max(4200, Math.min(24000, phrase.text.length * 64));
  showSpeech(phrase.text, baseMs, tag, theme);
  if (phrase.audio) {
    audio.playVoiceFile(
      phrase.audio,
      (durSec) => {
        const audioMs = Math.max(3600, Math.round(durSec * 1000));
        showSpeech(phrase.text, audioMs + 700, tag, theme);
      },
      onSpeechComplete
    );
  } else {
    audio.playRadioChirp();
    if (onSpeechComplete) {
      if (pendingShotTimer) clearTimeout(pendingShotTimer);
      pendingShotTimer = setTimeout(() => {
        pendingShotTimer = null;
        onSpeechComplete();
      }, 1300);
    }
  }
}

function speakModeLine(preferredCategories = null, forcedIds = {}, opts = {}) {
  const userInitiated = Boolean(opts.userInitiated);
  const interrupt = Boolean(opts.interrupt);
  const onlyExecute = opts.onlyExecute ?? null;
  const forceShootAfter = Boolean(opts.forceShootAfter);
  if (audio.currentVoice && !interrupt) {
    return true; // Never interrupt the soldier's active phrase mid-sentence
  }
  if (!userInitiated && eyebotState.isPlayingSpeech && audio.currentRadio) {
    return true; // Do not interrupt President Eden unless the user clicked on the soldier
  }
  if (state.voiceMode === 'sergeant') {
    const phrase = (forcedIds.sergeant && ALL_DORNAN_LOOKUP.get(forcedIds.sergeant))
      || pickDornanPhrase(preferredCategories, onlyExecute);
    const shouldShoot = forceShootAfter || Boolean(phrase.execute);
    playPhraseClip(phrase, '[СЕРЖАНТ ДОРНАН]', 'sergeant', shouldShoot ? executeShotNow : null);
    return true;
  }
  if (state.voiceMode === 'outpost') {
    const phrase = (forcedIds.outpost && OUTPOST_LOOKUP.get(forcedIds.outpost))
      || pickOutpostPhrase(preferredCategories, true, onlyExecute);
    const shouldShoot = forceShootAfter || Boolean(phrase.execute);
    playPhraseClip(phrase, `[${phrase.speaker || 'ПОСТ НАВАРРО'}]`, 'outpost', shouldShoot ? executeShotNow : null);
    return true;
  }
  return false;
}

function speakRandomLine(categories = null, userInitiated = true) {
  if (!userInitiated && eyebotState.isPlayingSpeech && audio.currentRadio) return;
  if (speakModeLine(categories, {}, { userInitiated })) return;
  const isExec = Math.random() < 0.25;
  const pool = isExec ? ENCLAVE_EXECUTE_LINES : ENCLAVE_LINES;
  const line = pool[Math.floor(Math.random() * pool.length)];
  audio.playRadioChirp();
  showSpeech(line, 4400);
  if (isExec) {
    if (pendingShotTimer) clearTimeout(pendingShotTimer);
    pendingShotTimer = setTimeout(() => {
      pendingShotTimer = null;
      executeShotNow();
    }, 1300);
  }
}

function refreshMenuChecks(syncToMain = true) {
  document.getElementById('chk-patrol').textContent = state.patrol ? 'ВКЛ' : 'ВЫКЛ';
  document.getElementById('chk-gravity').textContent = state.gravity ? 'ВКЛ' : 'ВЫКЛ';
  document.getElementById('chk-sound').textContent = state.sound ? 'ВКЛ' : 'ВЫКЛ';
  const chkEyebot = document.getElementById('chk-eyebot');
  if (chkEyebot) chkEyebot.textContent = state.eyebotEnabled ? 'ВКЛ' : 'ВЫКЛ';
  document.getElementById('chk-sleep').textContent = state.sleeping ? 'ВКЛ' : 'ВЫКЛ';
  const chkAuto = document.getElementById('chk-autostart');
  if (chkAuto) chkAuto.textContent = state.autoStart ? 'ВКЛ' : 'ВЫКЛ';

  const setSlider = (id, valId, v) => {
    const inp = document.getElementById(id);
    const lbl = document.getElementById(valId);
    const pct = Math.round(Math.max(0, Math.min(1, v)) * 100);
    if (inp) inp.value = String(pct);
    if (lbl) lbl.textContent = `${pct}%`;
  };
  setSlider('vol-master', 'val-master', state.masterVolume);
  setSlider('vol-voice', 'val-voice', state.voiceVolume);
  setSlider('vol-radio', 'val-radio', state.radioVolume);
  setSlider('vol-sfx', 'val-sfx', state.sfxVolume);

  for (const mode of ['sergeant', 'outpost']) {
    const el = document.getElementById(`chk-voice-${mode}`);
    if (el) el.textContent = state.voiceMode === mode ? '●' : '';
  }

  for (const id of Object.keys(ARMOR_MODELS)) {
    const el = document.getElementById(`chk-model-${id}`);
    if (el) el.textContent = state.armorModel === id ? '●' : '';
  }

  for (const wid of Object.keys(WEAPON_MODELS)) {
    const el = document.getElementById(`chk-weapon-${wid}`);
    if (el) el.textContent = state.weaponModel === wid ? '●' : '';
  }

  document.querySelectorAll('.scale-btn').forEach((btn) => {
    const val = parseFloat(btn.dataset.scale);
    btn.classList.toggle('active', Math.abs(val - state.scale) < 0.05);
  });

  if (syncToMain) {
    window.enclaveAPI.syncSettings({
      patrol: state.patrol,
      gravity: state.gravity,
      sound: state.sound,
      eyebotEnabled: state.eyebotEnabled,
      masterVolume: state.masterVolume,
      voiceVolume: state.voiceVolume,
      radioVolume: state.radioVolume,
      sfxVolume: state.sfxVolume,
      voiceMode: state.voiceMode,
      armorModel: state.armorModel,
      weaponModel: state.weaponModel,
      sleeping: state.sleeping,
      scale: state.scale,
      autoStart: state.autoStart
    });
  }
}

function openContextMenu(clientX, clientY) {
  state.menuOpen = true;
  window.enclaveAPI.setIgnoreMouse(false);

  contextMenu.classList.add('open');
  const menuW = contextMenu.offsetWidth || 215;
  const menuH = contextMenu.offsetHeight || 280;
  const left = Math.max(6, Math.min(window.innerWidth - menuW - 6, clientX));
  const top = Math.max(6, Math.min(window.innerHeight - menuH - 6, clientY));
  contextMenu.style.left = `${left}px`;
  contextMenu.style.top = `${top}px`;
}

function closeContextMenu() {
  if (!state.menuOpen) return;
  state.menuOpen = false;
  contextMenu.classList.remove('open');
}

// --- Load Enclave Soldier GLB & Build Rig ---
let rig = null;
let animator = null;
const gltfLoader = new GLTFLoader();
let isLoadingModel = false;

function disposeGroup(group) {
  if (!group) return;
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
          if (m[key] && m[key].dispose) m[key].dispose();
        }
        m.dispose();
      }
    }
  });
}

async function loadWeaponModel(weaponId, announce = false) {
  const entry = WEAPON_MODELS[weaponId];
  if (!entry || !rig) return false;
  try {
    const gltf = await gltfLoader.loadAsync(entry.path);
    attachWeaponToRig(rig, gltf.scene);
    state.weaponModel = weaponId;
    audio.setWeaponType(weaponId);
    refreshMenuChecks();
    console.info('[WEAPON_LOADED]', weaponId);
    if (announce && !audio.currentVoice) {
      audio.playReloadStep('chamber');
      showSpeech(`ОРУЖИЕ: ${entry.label.toUpperCase()}.`, 2800, '[АРСЕНАЛ]');
    }
    return true;
  } catch (err) {
    console.error('Failed to load weapon GLB:', weaponId, err);
    return false;
  }
}

async function loadArmorModel(modelId, announce = true) {
  const entry = ARMOR_MODELS[modelId];
  if (!entry || isLoadingModel) return false;
  isLoadingModel = true;

  try {
    loaderEl.textContent = `ЭКИПИРОВКА: ${entry.label.toUpperCase()}...`;
    loaderEl.style.display = 'block';
    loaderEl.classList.remove('hidden');

    const gltf = await gltfLoader.loadAsync(entry.path);
    const nextRig = buildEnclaveRig(gltf.scene, gltf.animations || []);

    if (rig) {
      scene.remove(rig.group);
      disposeGroup(rig.group);
    }

    rig = nextRig;
    scene.add(rig.group);

    animator = new EnclaveAnimator(rig, {
      onFootstep: () => {
        if (!state.falling && !state.dragging) {
          audio.playFootstep(0.58);
        }
      },
      onGaussFireMoment: () => {
        audio.playGaussFire();
        spawnGaussShot(rig);
      },
      onReloadStep: (step) => {
        audio.playReloadStep(step);
      }
    });

    if (state.sleeping) animator.setState('sleep');
    state.armorModel = modelId;
    await loadWeaponModel(state.weaponModel, false);
    refreshMenuChecks();

    loaderEl.classList.add('hidden');
    setTimeout(() => { loaderEl.style.display = 'none'; }, 400);

    if (announce) {
      audio.playServo(560);
      if (!speakModeLine(null, { sergeant: 'with_pa', outpost: 'guard_come_on' })) {
        showSpeech(`ЭКИПИРОВАНО: ${entry.label.toUpperCase()}.`, 3400);
      }
    }

    let skinnedCount = 0;
    rig.group.traverse((c) => { if (c.isSkinnedMesh) skinnedCount++; });
    console.info('[MODEL_LOADED]', modelId, JSON.stringify({
      bones: rig.skeleton.bones.length,
      meshes: skinnedCount
    }));
    return true;
  } catch (err) {
    loaderEl.textContent = 'ОШИБКА ЗАГРУЗКИ МОДЕЛИ';
    console.error('Failed to load GLB model:', modelId, err);
    return false;
  } finally {
    isLoadingModel = false;
  }
}

async function initModel() {
  const saved = await window.enclaveAPI.getSettings();
  if (saved) {
    if (typeof saved.patrol === 'boolean') state.patrol = saved.patrol;
    if (typeof saved.gravity === 'boolean') state.gravity = saved.gravity;
    if (typeof saved.sound === 'boolean') {
      state.sound = saved.sound;
      audio.setEnabled(state.sound);
    }
    if (typeof saved.eyebotEnabled === 'boolean') state.eyebotEnabled = saved.eyebotEnabled;
    if (typeof saved.masterVolume === 'number') state.masterVolume = saved.masterVolume;
    if (typeof saved.voiceVolume === 'number') state.voiceVolume = saved.voiceVolume;
    if (typeof saved.radioVolume === 'number') state.radioVolume = saved.radioVolume;
    if (typeof saved.sfxVolume === 'number') state.sfxVolume = saved.sfxVolume;
    audio.setMasterVolume(state.masterVolume);
    audio.setVoiceVolume(state.voiceVolume);
    audio.setRadioVolume(state.radioVolume);
    audio.setSfxVolume(state.sfxVolume);
    if (typeof saved.autoStart === 'boolean') state.autoStart = saved.autoStart;
    if (['sergeant', 'outpost'].includes(saved.voiceMode)) state.voiceMode = saved.voiceMode;
    else state.voiceMode = 'sergeant';
    if (ARMOR_MODELS[saved.armorModel]) state.armorModel = saved.armorModel;
    if (WEAPON_MODELS[saved.weaponModel]) {
      state.weaponModel = saved.weaponModel;
      audio.setWeaponType(state.weaponModel);
    }
    if (typeof saved.scale === 'number') state.scale = saved.scale;
    refreshMenuChecks(false);
  }

  state.winBounds = (await window.enclaveAPI.getWindowBounds()) || state.winBounds;
  state.workArea = (await window.enclaveAPI.getWorkArea()) || state.workArea;

  const initialModel = state.armorModel;
  if (window.location.search.includes('verifyAll=1')) {
    await loadArmorModel('remnants', false);
    if (animator && rig?.isFnvClipRig) {
      for (const st of ['walk', 'fire', 'inspect', 'scan', 'salute', 'dragged', 'land', 'sleep', 'idle']) {
        animator.setState(st);
        for (let k = 0; k < 6; k++) animator.update(0.08);
      }
      rig.group.updateMatrixWorld(true);
      const mp = new THREE.Vector3();
      const mt = new THREE.Vector3();
      rig.muzzleAnchor.getWorldPosition(mp);
      rig.muzzleTarget.getWorldPosition(mt);
      const dir = mt.clone().sub(mp).normalize();
      console.info('[FNV_CLIPS_VERIFIED]', JSON.stringify({
        clips: [...rig.clips.keys()],
        muzzle: mp.toArray().map(v => +v.toFixed(3)),
        barrelDir: dir.toArray().map(v => +v.toFixed(3))
      }));
    }
    await loadArmorModel('gannon', false);
    await loadArmorModel('enclave_fo3', false);
    await loadWeaponModel('laser', false);
    await loadWeaponModel('plasma', false);
    await loadWeaponModel('gauss', false);
    if (ENCLAVE_RADIO_MUSIC.length > 0) {
      for (const testSrc of [
        ENCLAVE_RADIO_MUSIC[0].audio,
        EDEN_MONOLOGUES[0]?.audio,
        EDEN_MONOLOGUES[1]?.audio,
        EDEN_SPEECHES[0]?.audio
      ].filter(Boolean)) {
        const rEl = audio.playRadioClip(testSrc);
        if (rEl) {
          await new Promise((resolve) => {
            const done = (ok) => {
              console.info('[RADIO_MUSIC_TEST]', JSON.stringify({ src: testSrc, ok, paused: rEl.paused, readyState: rEl.readyState, err: rEl.error?.code || null }));
              audio.stopRadio();
              resolve();
            };
            rEl.addEventListener('playing', () => done(true), { once: true });
            rEl.addEventListener('error', () => done(false), { once: true });
            setTimeout(() => done(!rEl.paused && rEl.readyState >= 2), 1200);
          });
        }
      }
    }
  }
  await loadArmorModel(initialModel, false);

  if (rig) {
    const isVerify = window.location.search.includes('verifyAll=1');
    if (!isVerify && state.sound && (state.voiceMode === 'sergeant' || state.voiceMode === 'outpost')) {
      speakModeLine(['intro'], {
        sergeant: Math.random() < 0.5 ? 'greeting' : 'name',
        outpost: Math.random() < 0.5 ? 'guard_greeting' : 'officer_video'
      }, { userInitiated: true, onlyExecute: false });
    } else {
      showSpeech('БОЕЦ СИЛОВОЙ БРОНИ ГОТОВ К СЛУЖБЕ.', 4200);
    }
    let skinnedCount = 0;
    rig.group.traverse((c) => { if (c.isSkinnedMesh) skinnedCount++; });
    console.info('[ENCLAVE_READY]', JSON.stringify({
      bones: rig.skeleton.bones.length,
      meshes: skinnedCount
    }));
  }
}

// --- Actions ---
function triggerFire(userInitiated = true) {
  if (!animator || state.dragging) return;
  if (state.sleeping) toggleSleep(false);

  if (audio.currentVoice || (!userInitiated && eyebotState.isPlayingSpeech && audio.currentRadio)) {
    // Never interrupt active soldier speech or President Eden's broadcast
    executeShotNow();
    return;
  }

  // First speak an execution phrase, then fire as soon as the phrase finishes
  if (!speakModeLine(['combat', 'alert'], {}, { userInitiated, onlyExecute: true, forceShootAfter: true })) {
    executeShotNow();
  }
}

function triggerSalute(userInitiated = true) {
  if (!animator || state.dragging) return;
  if (state.sleeping) toggleSleep(false);
  audio.playServo();
  animator.setState('salute');
  if (!speakModeLine(['salute', 'order', 'intro'], {
    sergeant: Math.random() < 0.5 ? 'sergeant' : 'my_orders',
    outpost: Math.random() < 0.5 ? 'guard_come_on' : 'officer_goodbye2'
  }, { userInitiated, onlyExecute: false })) {
    showSpeech('СЛАВА АНКЛАВУ, СЭР!', 3000);
  }
}

function triggerScan(userInitiated = true) {
  if (!animator || state.dragging) return;
  if (state.sleeping) toggleSleep(false);
  audio.playServo();
  animator.setState('scan');
  if (!speakModeLine(['alert', 'intro', 'idle'], {}, { userInitiated, onlyExecute: false })) {
    if (userInitiated || !(eyebotState.isPlayingSpeech && audio.currentRadio)) {
      showSpeech('СКАНИРОВАНИЕ ПЕРИМЕТРА...', 2800, '[СЕНСОРЫ MK II]');
    }
  }
}

function triggerInspect(userInitiated = true) {
  if (!animator || state.dragging) return;
  if (state.sleeping) toggleSleep(false);
  audio.playServo();
  animator.setState('inspect');
  if (!speakModeLine(['rant', 'order', 'idle'], {}, { userInitiated, onlyExecute: false })) {
    if (userInitiated || !(eyebotState.isPlayingSpeech && audio.currentRadio)) {
      showSpeech('КОНДЕНСАТОРЫ ГАУССА В НОРМЕ.', 2800, '[ДИАГНОСТИКА]');
    }
  }
}

function setVoiceMode(mode) {
  if (!['sergeant', 'outpost'].includes(mode)) return;
  state.voiceMode = mode;
  audio.stopVoice();
  if (state.sleeping) toggleSleep(false);

  if (mode === 'sergeant') {
    speakModeLine(null, { sergeant: 'greeting' }, { userInitiated: true, onlyExecute: false, interrupt: true });
  } else if (mode === 'outpost') {
    const startId = Math.random() < 0.5 ? 'guard_password_request' : 'officer_video';
    speakModeLine(null, { outpost: startId }, { userInitiated: true, onlyExecute: false, interrupt: true });
  }
  refreshMenuChecks();
}

function toggleSleep(nextVal) {
  state.sleeping = typeof nextVal === 'boolean' ? nextVal : !state.sleeping;
  if (animator) {
    if (state.sleeping) {
      animator.setState('sleep');
      audio.stopRadio();
      if (!speakModeLine(['sleep', 'idle'], { sergeant: 'post2', outpost: 'officer_gain' })) {
        showSpeech(SLEEP_LINES[Math.floor(Math.random() * SLEEP_LINES.length)], 3200, '[ЭНЕРГОСБЕРЕЖЕНИЕ]');
      }
    } else {
      audio.playServo();
      animator.setState('idle');
      scheduleNextRadioClip(1800);
      if (!speakModeLine(['order', 'intro'], { sergeant: 'post', outpost: 'guard_greeting' })) {
        showSpeech('СИСТЕМЫ БРОНИ ПЕРЕЗАПУЩЕНЫ.', 3000);
      }
    }
  }
  refreshMenuChecks();
}

async function applyScale(nextScale) {
  state.scale = Math.max(0.55, Math.min(1.9, nextScale));
  const bounds = await window.enclaveAPI.resizeWindow(state.scale);
  if (bounds) state.winBounds = bounds;
  refreshMenuChecks();
}

async function resetToTaskbar() {
  state.workArea = (await window.enclaveAPI.getWorkArea()) || state.workArea;
  state.winBounds = (await window.enclaveAPI.getWindowBounds()) || state.winBounds;
  const targetX = state.workArea.x + state.workArea.width - state.winBounds.width - 32;
  const targetY = state.workArea.y + state.workArea.height - state.winBounds.height;
  window.enclaveAPI.setWindowPos(targetX, targetY);
  state.winBounds.x = targetX;
  state.winBounds.y = targetY;
  state.falling = false;
  state.fallVy = 0;
  audio.playLand();
  if (animator) animator.setState('land');
}

// --- Mouse Interaction & Dragging ---
let dragOffset = { x: 0, y: 0 };
let dragStart = { x: 0, y: 0 };
let didDragMove = false;
let lastDragX = 0;
let lastDragY = 0;

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    closeContextMenu();
    audio.ensureContext();
    state.dragging = true;
    didDragMove = false;
    dragStart = { x: e.screenX, y: e.screenY };
    lastDragX = e.screenX;
    lastDragY = e.screenY;
    dragOffset = {
      x: e.screenX - state.winBounds.x,
      y: e.screenY - state.winBounds.y
    };
    canvas.classList.add('dragging');
    window.enclaveAPI.setIgnoreMouse(false);
  }
});

window.addEventListener('mousemove', (e) => {
  if (!state.dragging) return;
  const dist = Math.hypot(e.screenX - dragStart.x, e.screenY - dragStart.y);
  if (dist > 5) {
    didDragMove = true;
    if (animator && animator.state !== 'dragged') {
      if (state.sleeping) {
        state.sleeping = false;
        refreshMenuChecks();
      }
      animator.setState('dragged');
      audio.playServo(480);
      if (!audio.currentVoice && Math.random() < 0.7) {
        speakModeLine(['order', 'alert'], {
          sergeant: 'my_orders',
          outpost: Math.random() < 0.5 ? 'guard_pass_or_password' : 'officer_wise_guy'
        }, { userInitiated: true, onlyExecute: false });
      }
    }
  }
  if (didDragMove) {
    const vx = e.screenX - lastDragX;
    const vy = e.screenY - lastDragY;
    lastDragX = e.screenX;
    lastDragY = e.screenY;
    if (animator) animator.setDragVelocity(vx, vy);
    const nx = e.screenX - dragOffset.x;
    const ny = e.screenY - dragOffset.y;
    state.winBounds.x = nx;
    state.winBounds.y = ny;
    window.enclaveAPI.setWindowPos(nx, ny);
  }
});

window.addEventListener('mouseup', async (e) => {
  if (!state.dragging || e.button !== 0) return;
  state.dragging = false;
  canvas.classList.remove('dragging');
  if (animator) animator.setDragVelocity(0, 0);

  if (didDragMove) {
    state.workArea = (await window.enclaveAPI.getWorkArea()) || state.workArea;
    state.winBounds = (await window.enclaveAPI.getWindowBounds()) || state.winBounds;
    const floorY = state.workArea.y + state.workArea.height - state.winBounds.height;
    if (state.gravity && state.winBounds.y < floorY - 4) {
      state.falling = true;
      state.fallVy = 0;
    } else if (animator) {
      animator.setState('land');
      audio.playLand();
    }
  } else {
    // Click vs Double Click
    const now = performance.now();
    if (now - state.lastClickTime < 320) {
      state.lastClickTime = 0;
      triggerFire();
    } else {
      state.lastClickTime = now;
      setTimeout(() => {
        if (state.lastClickTime === now && !state.dragging) {
          if (state.sleeping) {
            toggleSleep(false);
          } else {
            const roll = Math.random();
            if (roll < 0.28) triggerSalute();
            else if (roll < 0.54) triggerScan();
            else if (roll < 0.78) triggerInspect();
            else speakRandomLine();
          }
        }
      }, 240);
    }
  }
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  audio.ensureContext();
  openContextMenu(e.clientX, e.clientY);
});

canvas.addEventListener('wheel', (e) => {
  if (state.menuOpen) return;
  e.preventDefault();
  const delta = e.deltaY < 0 ? 0.1 : -0.1;
  applyScale(state.scale + delta);
}, { passive: false });

document.addEventListener('mousedown', (e) => {
  if (state.menuOpen && !contextMenu.contains(e.target)) {
    closeContextMenu();
  }
});

contextMenu.addEventListener('click', (e) => {
  const scaleBtn = e.target.closest('.scale-btn');
  if (scaleBtn) {
    applyScale(parseFloat(scaleBtn.dataset.scale));
    closeContextMenu();
    return;
  }

  const modelBtn = e.target.closest('.model-item');
  if (modelBtn && modelBtn.dataset.model) {
    closeContextMenu();
    loadArmorModel(modelBtn.dataset.model, true);
    return;
  }

  const weaponBtn = e.target.closest('.weapon-item');
  if (weaponBtn && weaponBtn.dataset.weapon) {
    closeContextMenu();
    loadWeaponModel(weaponBtn.dataset.weapon, true);
    return;
  }

  const voiceBtn = e.target.closest('.voice-item');
  if (voiceBtn && voiceBtn.dataset.voice) {
    closeContextMenu();
    setVoiceMode(voiceBtn.dataset.voice);
    return;
  }

  const item = e.target.closest('.menu-item');
  if (!item) return;
  const action = item.dataset.action;
  closeContextMenu();

  if (action === 'fire') triggerFire();
  else if (action === 'inspect') triggerInspect();
  else if (action === 'salute') triggerSalute();
  else if (action === 'scan') triggerScan();
  else if (action === 'radio') speakRandomLine();
  else if (action === 'next-radio') playNextRadioTrack();
  else if (action === 'toggle-patrol') {
    state.patrol = !state.patrol;
    if (!state.patrol && animator && animator.state === 'walk') {
      animator.setWalkDirection(0);
      animator.setState('idle');
    }
    refreshMenuChecks();
  } else if (action === 'toggle-gravity') {
    state.gravity = !state.gravity;
    if (state.gravity) resetToTaskbar();
    refreshMenuChecks();
  } else if (action === 'toggle-sound') {
    state.sound = !state.sound;
    audio.setEnabled(state.sound);
    if (state.sound) scheduleNextRadioClip(1200);
    refreshMenuChecks();
  } else if (action === 'toggle-eyebot') {
    setEyebotEnabled(!state.eyebotEnabled);
  } else if (action === 'toggle-sleep') {
    toggleSleep();
  } else if (action === 'toggle-autostart') {
    window.enclaveAPI.setAutoStart(!state.autoStart).then((applied) => {
      state.autoStart = Boolean(applied);
      refreshMenuChecks();
      showSpeech(
        state.autoStart ? 'АВТОЗАПУСК С WINDOWS ВКЛЮЧЁН.' : 'АВТОЗАПУСК С WINDOWS ОТКЛЮЧЁН.',
        2800,
        '[ТЕРМИНАЛ АНКЛАВА]'
      );
    });
  } else if (action === 'reset-pos') {
    resetToTaskbar();
  } else if (action === 'hide') {
    window.enclaveAPI.hideToTray();
  } else if (action === 'quit') {
    window.enclaveAPI.quitApp();
  }
});

// --- IPC Events from Main Process ---
window.enclaveAPI.onCursorMove(({ cursorX, cursorY, winBounds }) => {
  state.cursorScreenX = cursorX;
  state.cursorScreenY = cursorY;
  if (winBounds && !state.dragging) {
    state.winBounds = winBounds;
  }

  if (animator && winBounds) {
    const charCenterX = winBounds.x + winBounds.width * 0.5;
    const charEyeY = winBounds.y + winBounds.height * 0.25;
    const dx = (cursorX - charCenterX) / 420;
    const dy = (cursorY - charEyeY) / 380;
    animator.setCursorAim(dx, dy);
  }
});

window.enclaveAPI.onTrayAction((action, payload) => {
  if (action === 'set-patrol') {
    state.patrol = Boolean(payload);
    if (!state.patrol && animator && animator.state === 'walk') {
      animator.setWalkDirection(0);
      animator.setState('idle');
    }
    refreshMenuChecks();
  } else if (action === 'set-gravity') {
    state.gravity = Boolean(payload);
    if (state.gravity) resetToTaskbar();
    refreshMenuChecks();
  } else if (action === 'set-sound') {
    state.sound = Boolean(payload);
    audio.setEnabled(state.sound);
    if (state.sound) scheduleNextRadioClip(1200);
    refreshMenuChecks();
  } else if (action === 'set-eyebot') {
    setEyebotEnabled(Boolean(payload));
  } else if (action === 'set-voice-mode') {
    setVoiceMode(String(payload));
  } else if (action === 'set-model') {
    loadArmorModel(String(payload), true);
  } else if (action === 'set-weapon') {
    loadWeaponModel(String(payload), true);
  } else if (action === 'set-sleep') {
    toggleSleep(Boolean(payload));
  } else if (action === 'set-autostart') {
    state.autoStart = Boolean(payload);
    refreshMenuChecks(false);
  } else if (action === 'set-scale') {
    applyScale(Number(payload));
  } else if (action === 'fire') {
    triggerFire();
  } else if (action === 'salute') {
    triggerSalute();
  } else if (action === 'radio') {
    speakRandomLine();
  } else if (action === 'next-radio') {
    playNextRadioTrack();
  } else if (action === 'reset-position') {
    resetToTaskbar();
  }
});

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

// --- Pixel-Perfect Alpha Hit-Testing for Click-Through ---
const gl = renderer.getContext();
const pixelBuf = new Uint8Array(4);

function updateClickThrough() {
  if (state.dragging || state.menuOpen) {
    if (state.ignoreMouse) {
      state.ignoreMouse = false;
      window.enclaveAPI.setIgnoreMouse(false);
    }
    return;
  }

  const lx = state.cursorScreenX - state.winBounds.x;
  const ly = state.cursorScreenY - state.winBounds.y;

  if (lx < 0 || ly < 0 || lx >= state.winBounds.width || ly >= state.winBounds.height) {
    if (!state.ignoreMouse) {
      state.ignoreMouse = true;
      window.enclaveAPI.setIgnoreMouse(true);
    }
    return;
  }

  const dpr = renderer.getPixelRatio();
  const px = Math.max(0, Math.min(canvas.width - 1, Math.floor(lx * dpr)));
  const py = Math.max(0, Math.min(canvas.height - 1, Math.floor(canvas.height - 1 - ly * dpr)));

  gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuf);
  const hit = pixelBuf[3] > 10;

  if (hit === state.ignoreMouse) {
    state.ignoreMouse = !hit;
    window.enclaveAPI.setIgnoreMouse(state.ignoreMouse);
  }
}

// --- Autonomous Patrol & Gravity Loop ---
let lastTime = performance.now();
let subPixelWalkX = 0;

function updateBehaviors(dt) {
  if (!animator) return;

  // 1. Gravity drop after dragging
  if (state.falling && !state.dragging) {
    const floorY = state.workArea.y + state.workArea.height - state.winBounds.height;
    state.fallVy += 2300 * dt;
    state.winBounds.y += state.fallVy * dt;

    if (state.winBounds.y >= floorY) {
      state.winBounds.y = floorY;
      state.falling = false;
      state.fallVy = 0;
      animator.setDragVelocity(0, 0);
      window.enclaveAPI.setWindowPos(state.winBounds.x, floorY);
      audio.playLand();
      animator.setState('land');
    } else {
      animator.setDragVelocity(0, Math.min(20, state.fallVy * 0.015));
      window.enclaveAPI.setWindowPos(state.winBounds.x, state.winBounds.y);
      animator.setState('dragged');
    }
    return;
  }

  // 2. Autonomous patrol along taskbar
  if (
    state.patrol &&
    !state.dragging &&
    !state.sleeping &&
    (animator.state === 'idle' || animator.state === 'walk')
  ) {
    state.patrolTimer -= dt;
    if (state.patrolTimer <= 0) {
      if (state.patrolMode === 'guard') {
        state.patrolMode = 'walk';
        state.patrolTimer = 3.2 + Math.random() * 4.0;
        const margin = 120;
        if (state.winBounds.x < state.workArea.x + margin) state.patrolDir = 1;
        else if (state.winBounds.x + state.winBounds.width > state.workArea.x + state.workArea.width - margin) state.patrolDir = -1;
        else state.patrolDir = Math.random() < 0.5 ? -1 : 1;

        animator.setWalkDirection(state.patrolDir);
        animator.setState('walk');
      } else {
        state.patrolMode = 'guard';
        state.patrolTimer = 5.5 + Math.random() * 6.5;
        animator.setWalkDirection(0);
        animator.setState('idle');

        // Occasional ambient radio remark or scan (without interrupting Eden)
        const r = Math.random();
        if (r < 0.22) speakRandomLine(null, false);
        else if (r < 0.40) triggerScan(false);
      }
    }

    // Periodic autonomous Gauss/Laser/Plasma shot (wait if soldier is currently speaking)
    state.autoFireTimer -= dt;
    if (state.autoFireTimer <= 0 && animator.state === 'idle') {
      if (audio.currentVoice) {
        state.autoFireTimer = 3.5;
      } else {
        state.autoFireTimer = 18 + Math.random() * 18;
        triggerFire(false);
      }
    }

    if (state.patrolMode === 'walk' && animator.state === 'walk') {
      const speedPx = 56 * state.scale;
      subPixelWalkX += state.patrolDir * speedPx * dt;
      if (Math.abs(subPixelWalkX) >= 1) {
        const moveInt = Math.trunc(subPixelWalkX);
        subPixelWalkX -= moveInt;
        const nextX = state.winBounds.x + moveInt;
        const minX = state.workArea.x + 12;
        const maxX = state.workArea.x + state.workArea.width - state.winBounds.width - 12;

        if (nextX <= minX) {
          state.patrolDir = 1;
          animator.setWalkDirection(1);
        } else if (nextX >= maxX) {
          state.patrolDir = -1;
          animator.setWalkDirection(-1);
        } else {
          state.winBounds.x = nextX;
          window.enclaveAPI.setWindowPos(nextX, state.winBounds.y);
        }
      }
    }
  }
}

// --- Orbiting Enclave Eyebot & Radio Broadcaster ---
const EDEN_MONOLOGUES = EDEN_SPEECHES.filter(
  (s) => !s.id.includes('inspirational_quote') && s.id !== 'eden_quote'
);
const EDEN_QUOTES = EDEN_SPEECHES.filter(
  (s) => s.id.includes('inspirational_quote') || s.id === 'eden_quote'
);

const eyebotState = {
  group: null,
  materials: [],
  orbitAngle: 0.7,
  time: 0,
  radioTimer: null,
  isPlayingSpeech: false,
  nextSlot: 'music', // Alternates: music -> monologue -> music -> quote
  nextSpeechIsMonologue: true,
  monologueIdx: 0,
  quoteIdx: Math.floor(Math.random() * Math.max(1, EDEN_QUOTES.length)),
  musicIdx: Math.floor(Math.random() * Math.max(1, ENCLAVE_RADIO_MUSIC.length))
};

function clearRadioTimer() {
  if (eyebotState.radioTimer) {
    clearTimeout(eyebotState.radioTimer);
    eyebotState.radioTimer = null;
  }
}

function playNextRadioTrack() {
  clearRadioTimer();
  eyebotState.isPlayingSpeech = false;
  audio.stopRadio();
  if (!state.eyebotEnabled) setEyebotEnabled(true);
  scheduleNextRadioClip(80);
}

function scheduleNextRadioClip(delayMs = 2600) {
  clearRadioTimer();
  if (window.location.search.includes('verifyAll=1')) return;
  if (!state.eyebotEnabled || !state.sound || state.sleeping) return;
  if (audio.currentRadio) return;

  eyebotState.radioTimer = setTimeout(() => {
    eyebotState.radioTimer = null;
    if (!state.eyebotEnabled || !state.sound || state.sleeping) return;

    // Wait if the soldier is currently speaking so Eden doesn't overlap him
    if (eyebotState.nextSlot === 'speech' && audio.currentVoice) {
      scheduleNextRadioClip(1800);
      return;
    }

    let clip = null;
    let isSpeech = false;
    if (eyebotState.nextSlot === 'speech' && EDEN_SPEECHES.length > 0) {
      isSpeech = true;
      if (eyebotState.nextSpeechIsMonologue && EDEN_MONOLOGUES.length > 0) {
        clip = EDEN_MONOLOGUES[eyebotState.monologueIdx % EDEN_MONOLOGUES.length];
        eyebotState.monologueIdx++;
      } else if (EDEN_QUOTES.length > 0) {
        clip = EDEN_QUOTES[eyebotState.quoteIdx % EDEN_QUOTES.length];
        eyebotState.quoteIdx++;
      } else {
        clip = EDEN_SPEECHES[Math.floor(Math.random() * EDEN_SPEECHES.length)];
      }
      eyebotState.nextSpeechIsMonologue = !eyebotState.nextSpeechIsMonologue;
      eyebotState.nextSlot = 'music';
    } else if (ENCLAVE_RADIO_MUSIC.length > 0) {
      clip = ENCLAVE_RADIO_MUSIC[eyebotState.musicIdx % ENCLAVE_RADIO_MUSIC.length];
      eyebotState.musicIdx++;
      eyebotState.nextSlot = 'speech';
    }

    if (!clip) return;
    eyebotState.isPlayingSpeech = isSpeech;
    audio.playRadioClip(clip.audio, () => {
      eyebotState.isPlayingSpeech = false;
      scheduleNextRadioClip(2200 + Math.random() * 2000);
    });
  }, delayMs);
}

function setEyebotEnabled(enabled) {
  state.eyebotEnabled = Boolean(enabled);
  if (eyebotState.group) {
    eyebotState.group.visible = state.eyebotEnabled;
  }
  if (!state.eyebotEnabled) {
    clearRadioTimer();
    audio.stopRadio();
  } else {
    scheduleNextRadioClip(600);
  }
  refreshMenuChecks();
}

async function initEyebot() {
  try {
    const gltf = await gltfLoader.loadAsync('../assets/models/eyebot.glb');
    const bot = gltf.scene;
    bot.scale.setScalar(1.38);
    let meshCount = 0;
    bot.traverse((obj) => {
      if (obj.isMesh) {
        meshCount++;
        obj.castShadow = true;
        obj.receiveShadow = true;
        const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        if (mat) {
          mat.envMapIntensity = 1.3;
          if (mat.emissiveMap || (mat.emissive && (mat.emissive.r + mat.emissive.g + mat.emissive.b > 0.1))) {
            mat.emissiveIntensity = 2.4;
            eyebotState.materials.push(mat);
          }
        }
      }
    });
    bot.visible = state.eyebotEnabled;
    scene.add(bot);
    eyebotState.group = bot;
    console.info('[EYEBOT_LOADED]', JSON.stringify({ meshes: meshCount }));
    if (state.eyebotEnabled && !state.sleeping) {
      const hasGreeting = state.sound && (state.voiceMode === 'sergeant' || state.voiceMode === 'outpost');
      scheduleNextRadioClip(hasGreeting ? 5200 : 2200);
    }
  } catch (err) {
    console.error('Failed to load eyebot.glb:', err);
  }
}

function updateEyebot(dt) {
  const bot = eyebotState.group;
  if (!bot) return;
  bot.visible = state.eyebotEnabled;
  if (!state.eyebotEnabled) return;

  eyebotState.time += dt;
  const speed = state.sleeping ? 0.15 : 0.72;
  eyebotState.orbitAngle += dt * speed;
  const a = eyebotState.orbitAngle;

  const rx = 0.80;
  const rz = 0.56;
  const x = Math.cos(a) * rx;
  const z = Math.sin(a) * rz;
  const baseY = state.sleeping ? 1.25 : 1.64;
  const bob = Math.sin(eyebotState.time * 2.9) * 0.045;
  bot.position.set(x, baseY + bob, z);

  // Face smoothly along the tangent of its orbital path + subtle banking
  const tx = -Math.sin(a) * rx;
  const tz = Math.cos(a) * rz;
  bot.rotation.set(
    Math.sin(eyebotState.time * 1.9) * 0.05,
    Math.atan2(tx, tz),
    -0.08
  );

  // Pulse amber sensor eye when Enclave Radio is transmitting
  const broadcasting = Boolean(audio.currentRadio);
  const targetGlow = state.sleeping ? 0.45 : (broadcasting ? 3.2 + Math.sin(eyebotState.time * 9.0) * 0.85 : 2.1);
  for (const mat of eyebotState.materials) {
    mat.emissiveIntensity = targetGlow;
  }
}

// Wire volume sliders in context menu without closing the menu on drag
for (const [inputId, valId, key, setter] of [
  ['vol-master', 'val-master', 'masterVolume', (v) => audio.setMasterVolume(v)],
  ['vol-voice', 'val-voice', 'voiceVolume', (v) => audio.setVoiceVolume(v)],
  ['vol-radio', 'val-radio', 'radioVolume', (v) => audio.setRadioVolume(v)],
  ['vol-sfx', 'val-sfx', 'sfxVolume', (v) => audio.setSfxVolume(v)]
]) {
  const inp = document.getElementById(inputId);
  if (!inp) continue;
  inp.addEventListener('mousedown', (e) => e.stopPropagation());
  inp.addEventListener('click', (e) => e.stopPropagation());
  inp.addEventListener('input', (e) => {
    const val = Math.max(0, Math.min(1, Number(e.target.value) / 100));
    state[key] = val;
    setter(val);
    const lbl = document.getElementById(valId);
    if (lbl) lbl.textContent = `${Math.round(val * 100)}%`;
  });
  inp.addEventListener('change', () => {
    refreshMenuChecks(true);
  });
}

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  updateBehaviors(dt);

  if (animator) {
    animator.update(dt);
    // Contact shadow softens when dragged high above taskbar
    const floorY = state.workArea.y + state.workArea.height - state.winBounds.height;
    const altitude = Math.max(0, floorY - state.winBounds.y);
    const groundFactor = Math.max(0.15, 1 - altitude / 240);
    contactShadow.material.opacity = state.dragging ? 0.25 : 0.78 * groundFactor;
    contactShadow.scale.setScalar(0.85 + (1 - groundFactor) * 0.35);
  }

  updateEyebot(dt);
  updateVfx(dt);
  renderer.render(scene, camera);
  updateClickThrough();
}

initModel();
initEyebot();
requestAnimationFrame(animate);
