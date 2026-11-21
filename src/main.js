const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');

let mainWindow = null;
let tray = null;
let cursorTimer = null;
let posSaveTimer = null;
let lastCursor = { x: -1, y: -1 };

const isVerify = process.argv.includes('--verify');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const DEFAULT_SETTINGS = {
  patrol: true,
  sound: true,
  gravity: true,
  alwaysOnTop: true,
  eyebotEnabled: true,
  masterVolume: 1.0,
  voiceVolume: 0.85,
  radioVolume: 0.50,
  sfxVolume: 0.80,
  scale: 1.0,
  sleeping: false,
  voiceMode: 'sergeant',
  armorModel: 'remnants',
  weaponModel: 'gauss',
  autoStart: false,
  windowX: null,
  windowY: null
};

const currentSettings = { ...DEFAULT_SETTINGS };

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function getLoginItemOptions() {
  if (app.isPackaged) return {};
  return {
    path: process.execPath,
    args: [app.getAppPath()]
  };
}

function getAutoStartEnabled() {
  try {
    const info = app.getLoginItemSettings(getLoginItemOptions());
    return Boolean(info.openAtLogin);
  } catch {
    return Boolean(currentSettings.autoStart);
  }
}

function applyAutoStart(enabled) {
  const next = Boolean(enabled);
  currentSettings.autoStart = next;
  if (isVerify) return next;
  try {
    app.setLoginItemSettings({
      openAtLogin: next,
      ...getLoginItemOptions()
    });
  } catch (err) {
    console.error('Failed to update login item settings:', err);
  }
  saveSettings();
  return getAutoStartEnabled();
}

function loadSettings() {
  try {
    const file = getSettingsPath();
    if (!fs.existsSync(file)) {
      const legacyFile = path.join(app.getPath('appData'), 'enclave-desktop-pet', 'settings.json');
      if (fs.existsSync(legacyFile)) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.copyFileSync(legacyFile, file);
      }
    }
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (typeof parsed.patrol === 'boolean') currentSettings.patrol = parsed.patrol;
      if (typeof parsed.sound === 'boolean') currentSettings.sound = parsed.sound;
      if (typeof parsed.gravity === 'boolean') currentSettings.gravity = parsed.gravity;
      if (typeof parsed.alwaysOnTop === 'boolean') currentSettings.alwaysOnTop = parsed.alwaysOnTop;
      if (typeof parsed.eyebotEnabled === 'boolean') currentSettings.eyebotEnabled = parsed.eyebotEnabled;
      if (typeof parsed.masterVolume === 'number' && Number.isFinite(parsed.masterVolume)) {
        currentSettings.masterVolume = Math.max(0, Math.min(1, parsed.masterVolume));
      }
      if (typeof parsed.voiceVolume === 'number' && Number.isFinite(parsed.voiceVolume)) {
        currentSettings.voiceVolume = Math.max(0, Math.min(1, parsed.voiceVolume));
      }
      if (typeof parsed.radioVolume === 'number' && Number.isFinite(parsed.radioVolume)) {
        currentSettings.radioVolume = Math.max(0, Math.min(1, parsed.radioVolume));
      }
      if (typeof parsed.sfxVolume === 'number' && Number.isFinite(parsed.sfxVolume)) {
        currentSettings.sfxVolume = Math.max(0, Math.min(1, parsed.sfxVolume));
      }
      if (typeof parsed.scale === 'number' && Number.isFinite(parsed.scale)) {
        currentSettings.scale = Math.max(0.55, Math.min(1.9, parsed.scale));
      }
      if (['sergeant', 'outpost'].includes(parsed.voiceMode)) {
        currentSettings.voiceMode = parsed.voiceMode;
      } else {
        currentSettings.voiceMode = 'sergeant';
      }
      if (['remnants', 'gannon', 'enclave_fo3'].includes(parsed.armorModel)) {
        currentSettings.armorModel = parsed.armorModel;
      } else {
        currentSettings.armorModel = 'remnants';
      }
      if (['gauss', 'laser', 'plasma'].includes(parsed.weaponModel)) {
        currentSettings.weaponModel = parsed.weaponModel;
      }
      if (typeof parsed.autoStart === 'boolean') currentSettings.autoStart = parsed.autoStart;
      if (typeof parsed.windowX === 'number' && Number.isFinite(parsed.windowX)) currentSettings.windowX = parsed.windowX;
      if (typeof parsed.windowY === 'number' && Number.isFinite(parsed.windowY)) currentSettings.windowY = parsed.windowY;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
  // Never boot stuck in sleep mode
  currentSettings.sleeping = false;
  if (!isVerify) {
    currentSettings.autoStart = getAutoStartEnabled() || currentSettings.autoStart;
  }
}

function saveSettings() {
  if (isVerify) return;
  try {
    const toSave = {
      patrol: currentSettings.patrol,
      sound: currentSettings.sound,
      gravity: currentSettings.gravity,
      alwaysOnTop: currentSettings.alwaysOnTop,
      eyebotEnabled: currentSettings.eyebotEnabled,
      masterVolume: currentSettings.masterVolume,
      voiceVolume: currentSettings.voiceVolume,
      radioVolume: currentSettings.radioVolume,
      sfxVolume: currentSettings.sfxVolume,
      scale: currentSettings.scale,
      voiceMode: currentSettings.voiceMode,
      armorModel: currentSettings.armorModel,
      weaponModel: currentSettings.weaponModel,
      autoStart: currentSettings.autoStart,
      windowX: currentSettings.windowX,
      windowY: currentSettings.windowY
    };
    fs.mkdirSync(path.dirname(getSettingsPath()), { recursive: true });
    fs.writeFileSync(getSettingsPath(), JSON.stringify(toSave, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save settings:', err);
  }
}

function schedulePositionSave() {
  if (isVerify || !mainWindow || mainWindow.isDestroyed()) return;
  if (posSaveTimer) clearTimeout(posSaveTimer);
  posSaveTimer = setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const b = mainWindow.getBounds();
    currentSettings.windowX = b.x;
    currentSettings.windowY = b.y;
    saveSettings();
  }, 450);
}

const BASE_WIN_WIDTH = 460;
const BASE_WIN_HEIGHT = 480;

function createEnclaveTrayIcon() {
  const size = 32;
  const raw = Buffer.alloc(size * (1 + size * 4));

  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0; // filter type 0
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);

      let r = 0, g = 0, b = 0, a = 0;

      // Dark metallic background disc
      if (dist <= 15.0) {
        r = 16; g = 22; b = 18; a = 245;
      }
      // Enclave amber-gold outer ring
      if (dist >= 12.2 && dist <= 14.5) {
        r = 255; g = 182; b = 66; a = 255;
      }
      // Stylized 'E' emblem inside
      const inE =
        (x >= 10 && x <= 13 && y >= 8 && y <= 23) ||
        (x >= 13 && x <= 22 && y >= 8 && y <= 11) ||
        (x >= 13 && x <= 20 && y >= 14 && y <= 17) ||
        (x >= 13 && x <= 22 && y >= 20 && y <= 23);

      if (inE) {
        r = 255; g = 196; b = 78; a = 255;
      }

      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = a;
    }
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);

  return nativeImage.createFromBuffer(png);
}

function getTargetWindowSize(scale = 1.0) {
  const clamped = Math.max(0.55, Math.min(1.9, Number(scale) || 1.0));
  return {
    width: Math.round(BASE_WIN_WIDTH * clamped),
    height: Math.round(BASE_WIN_HEIGHT * clamped)
  };
}

function getWorkAreaForWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return screen.getPrimaryDisplay().workArea;
  }
  const bounds = mainWindow.getBounds();
  return screen.getDisplayMatching(bounds).workArea;
}

function createWindow() {
  const primary = screen.getPrimaryDisplay().workArea;
  const { width, height } = getTargetWindowSize(currentSettings.scale);

  let startX = Math.round(primary.x + primary.width - width - 32);
  let startY = Math.round(primary.y + primary.height - height);

  if (typeof currentSettings.windowX === 'number' && typeof currentSettings.windowY === 'number') {
    const targetDisplay = screen.getDisplayNearestPoint({
      x: Math.round(currentSettings.windowX + width / 2),
      y: Math.round(currentSettings.windowY + height / 2)
    });
    const wa = targetDisplay ? targetDisplay.workArea : primary;
    startX = Math.max(wa.x - Math.round(width * 0.25), Math.min(wa.x + wa.width - Math.round(width * 0.75), Math.round(currentSettings.windowX)));
    startY = currentSettings.gravity
      ? Math.round(wa.y + wa.height - height)
      : Math.max(wa.y - Math.round(height * 0.2), Math.min(wa.y + wa.height - height, Math.round(currentSettings.windowY)));
  }

  mainWindow = new BrowserWindow({
    width,
    height,
    x: startX,
    y: startY,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: currentSettings.alwaysOnTop,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  mainWindow.setAlwaysOnTop(currentSettings.alwaysOnTop, currentSettings.alwaysOnTop ? 'screen-saver' : 'normal');
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  mainWindow.on('move', () => {
    schedulePositionSave();
  });

  if (process.argv.includes('--verify')) {
    const verifyTimeout = setTimeout(() => {
      console.error('[VERIFY_TIMEOUT] Model did not become ready in time.');
      app.exit(1);
    }, 25000);

    mainWindow.webContents.on('console-message', (detailsOrEvent, legacyLevel, legacyMsg) => {
      const level = typeof detailsOrEvent?.level === 'number' ? detailsOrEvent.level : legacyLevel;
      const message = typeof detailsOrEvent?.message === 'string' ? detailsOrEvent.message : legacyMsg;
      if (level >= 3) {
        console.error('[RENDERER_ERROR]', message);
      }
      if (message && message.includes('[MODEL_LOADED]')) {
        console.log(message);
      }
      if (message && message.includes('[ENCLAVE_READY]')) {
        console.log(message);
        console.log('[TRAY_ICON_VALID]', !createEnclaveTrayIcon().isEmpty());
        clearTimeout(verifyTimeout);
        setTimeout(() => app.exit(0), 1000);
      }
    });

    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      console.error('[RENDERER_GONE]', details);
      clearTimeout(verifyTimeout);
      app.exit(1);
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'), { query: { verifyAll: '1' } });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  startCursorPolling();
}

function startCursorPolling() {
  if (cursorTimer) clearInterval(cursorTimer);
  cursorTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return;
    const pt = screen.getCursorScreenPoint();
    if (pt.x === lastCursor.x && pt.y === lastCursor.y) return;
    lastCursor = pt;
    const bounds = mainWindow.getBounds();
    mainWindow.webContents.send('cursor-move', {
      cursorX: pt.x,
      cursorY: pt.y,
      winBounds: bounds
    });
  }, 33);
}

function buildTrayMenu() {
  if (!tray) return;
  const isVisible = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible();
  const menu = Menu.buildFromTemplate([
    {
      label: isVisible ? 'Скрыть компаньона' : 'Показать компаньона',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) mainWindow.hide();
        else mainWindow.show();
        buildTrayMenu();
      }
    },
    { type: 'separator' },
    {
      label: 'Патрулирование',
      type: 'checkbox',
      checked: currentSettings.patrol,
      click: (item) => {
        currentSettings.patrol = item.checked;
        sendTrayAction('set-patrol', item.checked);
      }
    },
    {
      label: 'Гравитация к панели задач',
      type: 'checkbox',
      checked: currentSettings.gravity,
      click: (item) => {
        currentSettings.gravity = item.checked;
        sendTrayAction('set-gravity', item.checked);
      }
    },
    {
      label: 'Поверх всех окон',
      type: 'checkbox',
      checked: currentSettings.alwaysOnTop,
      click: (item) => {
        currentSettings.alwaysOnTop = item.checked;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(item.checked, item.checked ? 'screen-saver' : 'normal');
        }
        sendTrayAction('set-always-on-top', item.checked);
      }
    },
    {
      label: 'Звуковые эффекты',
      type: 'checkbox',
      checked: currentSettings.sound,
      click: (item) => {
        currentSettings.sound = item.checked;
        saveSettings();
        sendTrayAction('set-sound', item.checked);
      }
    },
    {
      label: 'Робоглаз (Радио Анклава)',
      type: 'checkbox',
      checked: currentSettings.eyebotEnabled,
      click: (item) => {
        currentSettings.eyebotEnabled = item.checked;
        saveSettings();
        sendTrayAction('set-eyebot', item.checked);
      }
    },
    {
      label: 'Автозапуск с Windows',
      type: 'checkbox',
      checked: currentSettings.autoStart,
      click: (item) => {
        const applied = applyAutoStart(item.checked);
        buildTrayMenu();
        sendTrayAction('set-autostart', applied);
      }
    },
    {
      label: 'Режим персонажа',
      submenu: [
        {
          label: 'Режим-Сержанта (Дорнан)',
          type: 'radio',
          checked: currentSettings.voiceMode === 'sergeant',
          click: () => {
            currentSettings.voiceMode = 'sergeant';
            saveSettings();
            sendTrayAction('set-voice-mode', 'sergeant');
          }
        },
        {
          label: 'Часовой / Связь (Наварро и Гекко)',
          type: 'radio',
          checked: currentSettings.voiceMode === 'outpost',
          click: () => {
            currentSettings.voiceMode = 'outpost';
            saveSettings();
            sendTrayAction('set-voice-mode', 'outpost');
          }
        }
      ]
    },
    {
      label: 'Режим ожидания (Сон)',
      type: 'checkbox',
      checked: currentSettings.sleeping,
      click: (item) => {
        currentSettings.sleeping = item.checked;
        sendTrayAction('set-sleep', item.checked);
      }
    },
    { type: 'separator' },
    {
      label: 'Выстрел из оружия',
      click: () => sendTrayAction('fire')
    },
    {
      label: 'Воинское приветствие',
      click: () => sendTrayAction('salute')
    },
    {
      label: 'Радиосообщение Анклава',
      click: () => sendTrayAction('radio')
    },
    {
      label: 'Следующий трек Радио (Робоглаз)',
      click: () => sendTrayAction('next-radio')
    },
    {
      label: 'Вернуть на панель задач',
      click: () => sendTrayAction('reset-position')
    },
    { type: 'separator' },
    {
      label: 'Модель брони',
      submenu: [
        {
          label: 'Броня Оставшихся (FNV)',
          type: 'radio',
          checked: currentSettings.armorModel === 'remnants',
          click: () => {
            currentSettings.armorModel = 'remnants';
            saveSettings();
            sendTrayAction('set-model', 'remnants');
          }
        },
        {
          label: 'Броня Гэннонов Тесла (FNV)',
          type: 'radio',
          checked: currentSettings.armorModel === 'gannon',
          click: () => {
            currentSettings.armorModel = 'gannon';
            saveSettings();
            sendTrayAction('set-model', 'gannon');
          }
        },
        {
          label: 'Броня Анклава Mk II (FO3)',
          type: 'radio',
          checked: currentSettings.armorModel === 'enclave_fo3',
          click: () => {
            currentSettings.armorModel = 'enclave_fo3';
            saveSettings();
            sendTrayAction('set-model', 'enclave_fo3');
          }
        }
      ]
    },
    {
      label: 'Оружие',
      submenu: [
        {
          label: 'Гаусс-винтовка',
          type: 'radio',
          checked: currentSettings.weaponModel === 'gauss',
          click: () => {
            currentSettings.weaponModel = 'gauss';
            saveSettings();
            sendTrayAction('set-weapon', 'gauss');
          }
        },
        {
          label: 'Лазерная винтовка',
          type: 'radio',
          checked: currentSettings.weaponModel === 'laser',
          click: () => {
            currentSettings.weaponModel = 'laser';
            saveSettings();
            sendTrayAction('set-weapon', 'laser');
          }
        },
        {
          label: 'Плазменная винтовка',
          type: 'radio',
          checked: currentSettings.weaponModel === 'plasma',
          click: () => {
            currentSettings.weaponModel = 'plasma';
            saveSettings();
            sendTrayAction('set-weapon', 'plasma');
          }
        }
      ]
    },
    {
      label: 'Размер',
      submenu: [
        { label: 'Компактный (75%)', click: () => sendTrayAction('set-scale', 0.75) },
        { label: 'Стандартный (100%)', click: () => sendTrayAction('set-scale', 1.0) },
        { label: 'Крупный (130%)', click: () => sendTrayAction('set-scale', 1.3) },
        { label: 'Огромный (160%)', click: () => sendTrayAction('set-scale', 1.6) }
      ]
    },
    { type: 'separator' },
    {
      label: 'Выход',
      click: () => app.quit()
    }
  ]);
  tray.setContextMenu(menu);
}

function sendTrayAction(action, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
      buildTrayMenu();
    }
    mainWindow.webContents.send('tray-action', action, payload);
  }
}

function createTray() {
  const icon = createEnclaveTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('510 years — Enclave Desktop Companion');
  tray.on('double-click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else mainWindow.show();
    buildTrayMenu();
  });
  buildTrayMenu();
}

function setupIPC() {
  ipcMain.on('set-ignore-mouse', (_event, ignore) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (ignore) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      mainWindow.setIgnoreMouseEvents(false);
    }
  });

  ipcMain.on('move-window', (_event, { dx, dy }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const bounds = mainWindow.getBounds();
    const wa = getWorkAreaForWindow();
    const newX = Math.round(Math.max(wa.x - bounds.width * 0.25, Math.min(wa.x + wa.width - bounds.width * 0.75, bounds.x + dx)));
    const newY = Math.round(Math.max(wa.y - bounds.height * 0.2, Math.min(wa.y + wa.height - bounds.height, bounds.y + dy)));
    if (Number.isFinite(newX) && Number.isFinite(newY)) {
      mainWindow.setPosition(newX, newY, false);
    }
  });

  ipcMain.on('set-window-pos', (_event, { x, y }) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const bounds = mainWindow.getBounds();
    const allDisplays = screen.getAllDisplays();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const d of allDisplays) {
      minX = Math.min(minX, d.workArea.x);
      minY = Math.min(minY, d.workArea.y);
      maxX = Math.max(maxX, d.workArea.x + d.workArea.width);
      maxY = Math.max(maxY, d.workArea.y + d.workArea.height);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return;
    const clampedX = Math.round(Math.max(minX - bounds.width * 0.25, Math.min(maxX - bounds.width * 0.75, x)));
    const clampedY = Math.round(Math.max(minY - bounds.height * 0.2, Math.min(maxY - bounds.height, y)));
    if (Number.isFinite(clampedX) && Number.isFinite(clampedY)) {
      mainWindow.setPosition(clampedX, clampedY, false);
    }
  });

  ipcMain.handle('resize-window', (_event, scale) => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    const oldBounds = mainWindow.getBounds();
    const { width, height } = getTargetWindowSize(scale);
    const bottomCenter = {
      x: oldBounds.x + oldBounds.width / 2,
      y: oldBounds.y + oldBounds.height
    };
    const newX = Math.round(bottomCenter.x - width / 2);
    const newY = Math.round(bottomCenter.y - height);
    mainWindow.setBounds({ x: newX, y: newY, width, height }, false);
    return mainWindow.getBounds();
  });

  ipcMain.handle('get-window-bounds', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return null;
    return mainWindow.getBounds();
  });

  ipcMain.handle('get-window-workarea', () => getWorkAreaForWindow());
  ipcMain.handle('get-work-area', () => getWorkAreaForWindow());

  ipcMain.handle('get-settings', () => ({ ...currentSettings }));

  ipcMain.handle('set-auto-start', (_event, enabled) => {
    const applied = applyAutoStart(enabled);
    buildTrayMenu();
    return applied;
  });

  ipcMain.on('sync-settings', (_event, settings) => {
    Object.assign(currentSettings, settings);
    if (mainWindow && !mainWindow.isDestroyed() && typeof settings.alwaysOnTop === 'boolean') {
      mainWindow.setAlwaysOnTop(settings.alwaysOnTop, settings.alwaysOnTop ? 'screen-saver' : 'normal');
    }
    saveSettings();
    buildTrayMenu();
  });

  ipcMain.on('hide-to-tray', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
      buildTrayMenu();
    }
  });

  ipcMain.on('quit-app', () => {
    app.quit();
  });
}

const gotSingleInstanceLock = isVerify ? true : app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  if (!isVerify) {
    app.on('second-instance', () => {
      if (mainWindow) {
        if (!mainWindow.isVisible()) mainWindow.show();
        mainWindow.focus();
      }
    });
  }

  app.whenReady().then(() => {
    loadSettings();
    setupIPC();
    createWindow();
    if (!isVerify) createTray();
  });
}

app.on('window-all-closed', () => {
  if (cursorTimer) clearInterval(cursorTimer);
  app.quit();
});
