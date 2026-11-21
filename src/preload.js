const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('enclaveAPI', {
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', Boolean(ignore)),
  moveWindow: (dx, dy) => ipcRenderer.send('move-window', { dx, dy }),
  setWindowPos: (x, y) => ipcRenderer.send('set-window-pos', { x, y }),
  resizeWindow: (size) => ipcRenderer.invoke('resize-window', size),
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  getWorkArea: () => ipcRenderer.invoke('get-work-area'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-start', Boolean(enabled)),
  syncSettings: (settings) => ipcRenderer.send('sync-settings', settings),
  hideToTray: () => ipcRenderer.send('hide-to-tray'),
  quitApp: () => ipcRenderer.send('quit-app'),
  onCursorMove: (cb) => {
    const listener = (_event, data) => cb(data);
    ipcRenderer.on('cursor-move', listener);
    return () => ipcRenderer.removeListener('cursor-move', listener);
  },
  onTrayAction: (cb) => {
    const listener = (_event, action, payload) => cb(action, payload);
    ipcRenderer.on('tray-action', listener);
    return () => ipcRenderer.removeListener('tray-action', listener);
  }
});
