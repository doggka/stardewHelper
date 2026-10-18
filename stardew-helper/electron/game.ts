import fs from 'node:fs';
import path from 'node:path';
import type { GameInfo, ModInfo } from '../src/types';

/** Моды, про которые рассказывает экран бутстрапа. */
export const MODS = [
  {
    key: 'SMAPI',
    folder: null,
    name: 'SMAPI',
    what: 'загрузчик модов',
    why: 'без него не работает ничего из списка ниже',
    url: 'https://smapi.io/',
  },
  {
    key: 'NPCMapLocations',
    folder: 'NPCMapLocations',
    name: 'NPC Map Locations',
    what: 'все жители и игроки на карте, плюс миникарта',
    why: 'не бегать по городу в поисках нужного NPC',
    url: 'https://www.nexusmods.com/stardewvalley/mods/239',
  },
  {
    key: 'UIInfoSuite2',
    folder: 'UIInfoSuite2',
    name: 'UI Info Suite 2',
    what: 'подсказки прямо в интерфейсе игры',
    why: 'иконка торговки пульсирует, когда у неё есть предметы для узелков — прямо под красную капусту',
    url: 'https://www.nexusmods.com/stardewvalley/mods/43127',
  },
  {
    key: 'LookupAnything',
    folder: 'LookupAnything',
    name: 'Lookup Anything',
    what: 'F1 по любому объекту — подробности',
    why: '«когда созреет», «что этому нравится» без похода на вики',
    url: 'https://www.nexusmods.com/stardewvalley/mods/541',
  },
  {
    key: 'DataLayers',
    folder: 'DataLayers',
    name: 'Data Layers',
    what: 'оверлей зон покрытия',
    why: 'спринклеры, пугала, ульи и скрытые проходы видно сразу',
    url: 'https://www.nexusmods.com/stardewvalley/mods/1691',
  },
] as const;

/** Ищем игру через библиотеки Steam — она далеко не всегда в стандартной папке. */
export function detectGame(): GameInfo {
  const candidates: string[] = [];

  for (const base of [
    path.join('C:', 'Program Files (x86)', 'Steam'),
    path.join('C:', 'Program Files', 'Steam'),
  ]) {
    const vdf = path.join(base, 'steamapps', 'libraryfolders.vdf');
    if (!fs.existsSync(vdf)) continue;
    let text = '';
    try {
      text = fs.readFileSync(vdf, 'utf8');
    } catch {
      continue;
    }
    // каждый блок библиотеки: "path" "…", затем список приложений
    const blocks = text.split(/"\d+"\s*\{/).slice(1);
    for (const block of blocks) {
      const p = block.match(/"path"\s*"([^"]+)"/);
      if (!p) continue;
      if (!/"413150"/.test(block)) continue;
      candidates.push(path.join(p[1].replace(/\\\\/g, '\\'), 'steamapps', 'common', 'Stardew Valley'));
    }
  }

  candidates.push(
    path.join('C:', 'Program Files (x86)', 'Steam', 'steamapps', 'common', 'Stardew Valley'),
    path.join('C:', 'Program Files', 'Steam', 'steamapps', 'common', 'Stardew Valley'),
    path.join('C:', 'GOG Games', 'Stardew Valley'),
  );

  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'Stardew Valley.exe'))) {
      const modsPath = path.join(c, 'Mods');
      return {
        path: c,
        smapiInstalled: fs.existsSync(path.join(c, 'StardewModdingAPI.exe')),
        modsPath: fs.existsSync(modsPath) ? modsPath : null,
      };
    }
  }
  return { path: null, smapiInstalled: false, modsPath: null };
}

function modVersion(dir: string): string | null {
  const manifest = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifest)) return null;
  try {
    const j = JSON.parse(fs.readFileSync(manifest, 'utf8').replace(/^﻿/, ''));
    return typeof j.Version === 'string' ? j.Version : null;
  } catch {
    return null;
  }
}

export function listMods(game: GameInfo): ModInfo[] {
  const out: ModInfo[] = [];
  for (const m of MODS) {
    if (m.key === 'SMAPI') {
      out.push({ key: m.key, name: m.name, installed: game.smapiInstalled, version: null });
      continue;
    }
    let installed = false;
    let version: string | null = null;
    if (game.modsPath && fs.existsSync(game.modsPath)) {
      let entries: string[] = [];
      try {
        entries = fs.readdirSync(game.modsPath);
      } catch {
        entries = [];
      }
      // папка мода может называться как угодно — ищем по manifest.json
      for (const e of entries) {
        const dir = path.join(game.modsPath, e);
        const man = path.join(dir, 'manifest.json');
        if (!fs.existsSync(man)) continue;
        try {
          const j = JSON.parse(fs.readFileSync(man, 'utf8').replace(/^﻿/, ''));
          const uid = String(j.UniqueID || '');
          const nm = String(j.Name || '');
          if (uid.toLowerCase().includes(m.folder!.toLowerCase()) || nm.replace(/\s/g, '').toLowerCase().includes(m.folder!.toLowerCase())) {
            installed = true;
            version = modVersion(dir);
            break;
          }
        } catch {
          /* битый манифест просто пропускаем */
        }
      }
    }
    out.push({ key: m.key, name: m.name, installed, version });
  }
  return out;
}
