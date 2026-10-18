import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const ROOT = path.join(__dirname, '..');

let win: BrowserWindow | null = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,
    backgroundColor: '#1d1a16',
    title: 'Stardew Helper',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.once('ready-to-show', () => win?.show());

  // Внешние ссылки открываем в системном браузере, а не внутри окна —
  // иначе приложение превращается в браузер и из него не выбраться.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (DEV_URL && url.startsWith(DEV_URL)) return;
    e.preventDefault();
    shell.openExternal(url);
  });

  if (DEV_URL) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(ROOT, 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());

function registerIpc() {
  ipcMain.handle('app:openExternal', (_e, url: string) => shell.openExternal(url));

  ipcMain.handle('win:minimize', () => win?.minimize());
  ipcMain.handle('win:toggleMaximize', () => {
    if (!win) return false;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
    return win.isMaximized();
  });
  ipcMain.handle('win:close', () => win?.close());

  ipcMain.handle('dialog:pickFolder', async (_e, title: string) => {
    if (!win) return null;
    const r = await dialog.showOpenDialog(win, {
      title,
      properties: ['openDirectory'],
    });
    return r.canceled ? null : r.filePaths[0];
  });
}

export { fileURLToPath };
