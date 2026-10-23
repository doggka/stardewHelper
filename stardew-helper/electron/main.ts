import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DEFAULT_ROOT, listSaves, readSaveById } from './saves';
import { readBelongings } from './belongings';
import { detectGame, listMods, readBridge, readIcons } from './game';

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
  // что уже лежит в сундуках и растёт на грядках — из того же сейва
  ipcMain.handle('saves:belongings', (_e, id: string) => {
    const s = readSaveById(getRoots(), id);
    return s ? readBelongings(s.file) : null;
  });

  ipcMain.handle('game:detect', () => detectGame());
  ipcMain.handle('game:mods', () => listMods(detectGame()));
  ipcMain.handle('game:runBootstrap', (_e, opts: { mode?: string; openNexus?: boolean } = {}) =>
    runBootstrap(opts),
  );
  ipcMain.handle('game:cancelBootstrap', () => {
    if (!bootstrap) return false;
    bootstrap.kill();
    bootstrap = null;
    return true;
  });
  ipcMain.handle('game:bootstrapInConsole', () => {
    const script = bootstrapScript();
    if (!script) return { started: false, error: 'install-mods.ps1 не найден' };
    try {
      // cmd /c start — единственный надёжный способ получить настоящую консоль
      // с рабочим вводом: напрямую spawn даёт процесс без доступного stdin.
      spawn('cmd.exe', ['/c', 'start', '"Установка модов"', 'powershell.exe',
        '-NoExit', '-ExecutionPolicy', 'Bypass', '-File', `"${script}"`,
        '-DropDir', `"${dropDir()}"`], {
        detached: true,
        stdio: 'ignore',
        windowsVerbatimArguments: true,
      }).unref();
      return { started: true };
    } catch (err) {
      return { started: false, error: String(err) };
    }
  });

  ipcMain.handle('game:launch', (_e, mode: string) => launchGame(mode));
  ipcMain.handle('game:bridge', () => readBridge(detectGame()));
  ipcMain.handle('game:icons', () => readIcons(detectGame()));

  ipcMain.handle('game:dropDir', () => dropDir());
  ipcMain.handle('game:openDropDir', () => {
    const d = dropDir();
    try {
      fs.mkdirSync(d, { recursive: true });
    } catch {
      /* если не создалась — shell всё равно покажет, что не так */
    }
    return shell.openPath(d);
  });
}

/* ---- запуск игры ---- */

const STEAM_APP_ID = '413150';

/**
 * Запуск одним из трёх способов. Прямой запуск exe идёт мимо Steam —
 * оверлей и учёт времени в игре работать не будут, поэтому вариант
 * «через Steam» оставлен отдельным пунктом, а не выкинут.
 */
async function launchGame(mode: string): Promise<{ ok: boolean; error?: string; cmd?: string }> {
  if (mode === 'steam') {
    void shell.openExternal('steam://rungameid/' + STEAM_APP_ID);
    return { ok: true, cmd: 'steam://rungameid/' + STEAM_APP_ID };
  }

  const game = detectGame();
  if (!game.path) return { ok: false, error: 'папка с игрой не найдена' };

  const exe = mode === 'smapi'
    ? path.join(game.path, 'StardewModdingAPI.exe')
    : path.join(game.path, 'Stardew Valley.exe');

  if (!fs.existsSync(exe)) {
    return {
      ok: false,
      error: mode === 'smapi'
        ? 'StardewModdingAPI.exe не найден — SMAPI не установлен'
        : 'Stardew Valley.exe не найден',
    };
  }

  // Именно openPath, а не spawn: это то же самое, что двойной клик в проводнике.
  // SMAPI — консольное приложение, и через spawn с stdio:'ignore' оно получало
  // пустые потоки и падало молча, а мы при этом рапортовали об успехе.
  const err = await shell.openPath(exe);
  return err ? { ok: false, error: err } : { ok: true, cmd: exe };
}

/* ---- запуск бутстрапа с перехватом вывода ---- */

let bootstrap: ReturnType<typeof spawn> | null = null;

/**
 * Папка, куда пользователь кладёт скачанные с Nexus архивы.
 *
 * Держим её в данных приложения, а не рядом со скриптом или с exe:
 * у портативной сборки скрипт распаковывается во временный каталог и пропадает
 * после закрытия, а оба exe лежат внутри release, который стирается при каждой
 * пересборке. Путь показывается на экране модов, и рядом есть кнопка «Открыть
 * папку», так что прятаться ему не страшно.
 */
function dropDir(): string {
  return path.join(app.getPath('userData'), 'drop');
}

function bootstrapScript(): string | null {
  // В собранном приложении скрипт лежит в resources рядом с asar:
  // из самого asar PowerShell читать не умеет.
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, 'install-mods.ps1')]
    : [path.join(ROOT, 'install-mods.ps1')];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function runBootstrap(opts: { mode?: string; openNexus?: boolean }): { started: boolean; error?: string } {
  if (bootstrap) return { started: false, error: 'установка уже идёт' };
  const script = bootstrapScript();
  if (!script) return { started: false, error: 'install-mods.ps1 не найден рядом с приложением' };

  // Режим задаётся строкой и только явное 'install' ставит моды. Любая другая
  // величина — включая потерянный при передаче объект — даёт сухой прогон.
  // Раньше здесь был булев флаг, и его пропажа молча превращалась в установку.
  const install = opts?.mode === 'install';

  const args = ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-File', script, '-DropDir', dropDir()];
  args.push(install ? '-Yes' : '-DryRun');
  if (opts?.openNexus) args.push('-OpenNexus');

  const send = (channel: string, payload: unknown) => win?.webContents.send(channel, payload);

  try {
    // Первой строкой печатаем саму команду: иначе невозможно понять,
    // в каком режиме скрипт реально запустился. Аргументы с пробелами
    // берём в кавычки, чтобы строку можно было скопировать и запустить руками.
    const shown = args.map((a) => (/\s/.test(a) ? '"' + a + '"' : a)).join(' ');
    send('bootstrap:line', { line: '> powershell ' + shown, isErr: false });

    const child = spawn('powershell.exe', args, { windowsHide: true });
    bootstrap = child;

    // Строки отдаём в окно по мере появления, чтобы лог бежал, а не падал пачкой.
    let tail = '';
    const pump = (buf: Buffer, isErr: boolean) => {
      tail += buf.toString('utf8');
      const lines = tail.split(/\r?\n/);
      tail = lines.pop() ?? '';
      for (const line of lines) send('bootstrap:line', { line, isErr });
    };
    child.stdout?.on('data', (b: Buffer) => pump(b, false));
    child.stderr?.on('data', (b: Buffer) => pump(b, true));

    child.on('error', (err) => {
      send('bootstrap:line', { line: 'Не удалось запустить PowerShell: ' + String(err), isErr: true });
      send('bootstrap:done', { code: -1 });
      bootstrap = null;
    });
    child.on('close', (code) => {
      if (tail) send('bootstrap:line', { line: tail, isErr: false });
      send('bootstrap:done', { code });
      bootstrap = null;
    });

    return { started: true };
  } catch (err) {
    bootstrap = null;
    return { started: false, error: String(err) };
  }
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
