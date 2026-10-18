import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DEFAULT_ROOT, listSaves, readSaveById } from './saves';
import { detectGame, listMods } from './game';

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const ROOT = path.join(__dirname, '..');

// Запуск с отладочным портом уводит приложение в отдельный профиль.
// Иначе проверки затирают реальное состояние пользователя: выбранный сейв,
// галочки, фильтры — всё это живёт в localStorage профиля.
if (process.argv.some((a) => a.startsWith('--remote-debugging-port'))) {
  app.setPath('userData', app.getPath('userData') + ' (debug)');
}

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
    // Иконку окна и панели задач ставим здесь. Вшить её в сам .exe нельзя:
    // для этого нужен winCodeSign, который не распаковывается без прав
    // администратора или режима разработчика Windows.
    icon: path.join(ROOT, 'dist', 'icon-256.png'),
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

  ipcMain.handle('saves:roots', () => getRoots());
  ipcMain.handle('saves:addRoot', (_e, p: string) => {
    const roots = getRoots();
    if (p && !roots.includes(p)) roots.push(p);
    setRoots(roots);
    return roots;
  });
  ipcMain.handle('saves:removeRoot', (_e, p: string) => {
    const roots = getRoots().filter((r) => r !== p);
    setRoots(roots);
    return roots;
  });
  ipcMain.handle('saves:list', () => listSaves(getRoots()));
  ipcMain.handle('saves:read', (_e, id: string) => readSaveById(getRoots(), id));

  ipcMain.handle('game:detect', () => detectGame());
  ipcMain.handle('game:mods', () => listMods(detectGame()));
  ipcMain.handle('game:runBootstrap', () => {
    // В собранном приложении скрипт лежит в resources рядом с asar:
    // из самого asar PowerShell читать не умеет.
    const candidates = app.isPackaged
      ? [path.join(process.resourcesPath, 'install-mods.ps1')]
      : [path.join(ROOT, 'install-mods.ps1')];
    const script = candidates.find((p) => fs.existsSync(p));
    if (!script) return { started: false, error: 'install-mods.ps1 не найден: ' + candidates.join(', ') };
    try {
      // отдельное окно PowerShell: установка идёт на глазах, а не молча в фоне
      spawn('powershell.exe', ['-NoExit', '-ExecutionPolicy', 'Bypass', '-File', script], {
        detached: true,
        stdio: 'ignore',
      }).unref();
      return { started: true };
    } catch (err) {
      return { started: false, error: String(err) };
    }
  });
}

/* ---- список папок с сейвами, переживает перезапуск ---- */

function rootsFile(): string {
  return path.join(app.getPath('userData'), 'save-roots.json');
}

function getRoots(): string[] {
  let saved: string[] = [];
  try {
    saved = JSON.parse(fs.readFileSync(rootsFile(), 'utf8'));
  } catch {
    saved = [];
  }
  const roots = Array.isArray(saved) ? saved.slice() : [];
  if (!roots.includes(DEFAULT_ROOT)) roots.unshift(DEFAULT_ROOT);
  return roots.filter((r) => {
    try {
      return fs.statSync(r).isDirectory();
    } catch {
      return false;
    }
  });
}

function setRoots(roots: string[]): void {
  try {
    fs.writeFileSync(rootsFile(), JSON.stringify(roots, null, 1), 'utf8');
  } catch {
    /* не смогли сохранить — не критично, просто спросим снова */
  }
}
