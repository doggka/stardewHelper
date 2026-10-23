import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ROOMS } from '../src/data/bundles';
import { SEASON_KEY } from '../src/data/constants';
import type { SaveSummary, Season } from '../src/types';

/**
 * Чтение сохранений Stardew Valley. Только чтение — в сейв не пишем никогда.
 *
 * Структура: CommunityCenter → <bundles>, ключ — индекс узелка,
 * значение — ArrayOfBoolean длиной 3 × (число предметов в узелке).
 * Индекс i соответствует предмету №i; при полном закрытии узелка игра
 * красит весь массив, а не только значимую часть.
 */

export const DEFAULT_ROOT = path.join(os.homedir(), 'AppData', 'Roaming', 'StardewValley', 'Saves');

/** saveKey → сколько предметов ожидаем. Узелки Сейфа хранят один «предмет» — оплату. */
const EXPECTED = new Map<number, { id: string; items: number }>();
for (const r of ROOMS) {
  for (const b of r.bundles) {
    EXPECTED.set(b.saveKey, { id: b.id, items: b.items ? b.items.length : 1 });
  }
}
const VAULT_KEYS = new Set(
  ROOMS.filter((r) => r.vault).flatMap((r) => r.bundles.map((b) => b.saveKey)),
);

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp('<' + name + '>(.*?)</' + name + '>'));
  return m ? m[1] : null;
}

/**
 * Погода в долине. Хранится по «контекстам»: у острова и пустыни своя,
 * нам нужен Default. Рядом лежит weatherForTomorrow — его легко перепутать,
 * поэтому тег сопоставляется точно.
 *
 * Нас интересует только «мокро или нет»: дождём считаются Rain, Storm
 * и зелёный дождь. Wind — это мусор в воздухе, а Snow в игре дождём
 * не считается, и рыба на дождь при снеге не ловится.
 */
const wet = (w: string): 'sun' | 'rain' =>
  w === 'Rain' || w === 'Storm' || w === 'GreenRain' ? 'rain' : 'sun';

function weatherBlock(xml: string): RegExpExecArray | null {
  return /<key><string>Default<\/string><\/key><value><LocationWeather><weatherForTomorrow><string>([A-Za-z]*)<\/string><\/weatherForTomorrow><weather><string>([A-Za-z]*)<\/string><\/weather>/.exec(xml);
}

function readWeather(xml: string): 'sun' | 'rain' {
  const m = weatherBlock(xml);
  return wet(m ? m[2] : 'Sun');
}

/**
 * Погода на завтра. Игра знает её заранее, и это решение на сегодняшний
 * вечер: польёт само, или готовь удочку, или успей посадить.
 */
function readWeatherTomorrow(xml: string): 'sun' | 'rain' {
  const m = weatherBlock(xml);
  return wet(m ? m[1] : 'Sun');
}

interface ParsedBundles {
  byKey: Map<number, boolean[]>;
}

function parseBundles(xml: string): ParsedBundles {
  const byKey = new Map<number, boolean[]>();
  const block = xml.match(/<bundles>([\s\S]*?)<\/bundles>/);
  if (!block) return { byKey };
  const re = /<item><key><int>(\d+)<\/int><\/key><value><ArrayOfBoolean>([\s\S]*?)<\/ArrayOfBoolean><\/value><\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block[1]))) {
    const flags: boolean[] = [];
    const fre = /<boolean>(true|false)<\/boolean>/g;
    let f: RegExpExecArray | null;
    while ((f = fre.exec(m[2]))) flags.push(f[1] === 'true');
    byKey.set(parseInt(m[1], 10), flags);
  }
  return { byKey };
}

/** Узелок считается читаемым, если число флагов совпало: длина = 3 × число предметов. */
function keyOk(flags: boolean[], expectedItems: number): boolean {
  return flags.length === expectedItems * 3;
}

/**
 * Состав узелка в сейве может не совпасть с нашим: в 1.5 Животноводческий узелок
 * имел 11 предметов вместо 6, а смешанные узелки меняют вообще всё. Сопоставление
 * идёт по позиции, поэтому такие узелки пропускаем — но только их, а не весь сейв.
 * Если расходится почти всё, это уже смешанные узелки, и импорт целиком бессмысленен.
 */
const REMIX_THRESHOLD = 4;

function readSaveFile(folder: string, root: string): SaveSummary | null {
  const name = path.basename(folder);
  const file = path.join(folder, name);
  if (!fs.existsSync(file)) return null;

  let xml: string;
  try {
    xml = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }

  const weather = readWeather(xml);
  const weatherTomorrow = readWeatherTomorrow(xml);
  // удача дня, −0.1…0.1 — то, что духи говорят по телевизору
  const luck = parseFloat(tag(xml, 'dailyLuck') || '0') || 0;
  const seasonKey = tag(xml, 'currentSeason') || 'spring';
  const season = Math.max(0, SEASON_KEY.indexOf(seasonKey)) as Season;
  const version = tag(xml, 'gameVersion');
  const playerMatch = xml.match(/<player>[\s\S]*?<name>(.*?)<\/name>/);

  const { byKey } = parseBundles(xml);

  const progress: Record<string, number[]> = {};
  const vault: Record<string, boolean> = {};
  const skipped: string[] = [];
  let donatedCount = 0;
  let completedBundles = 0;

  for (const [key, exp] of EXPECTED) {
    const flags = byKey.get(key);
    if (!flags || !flags.length) continue; // узелок ещё не открыт — это нормально
    if (!keyOk(flags, exp.items)) {
      skipped.push(exp.id);
      continue;
    }
    const complete = flags.every(Boolean);
    const idx: number[] = [];
    for (let i = 0; i < exp.items; i++) if (complete || flags[i]) idx.push(i);

    if (VAULT_KEYS.has(key)) {
      vault[exp.id] = idx.length > 0;
      if (idx.length) completedBundles++;
      continue;
    }
    if (idx.length) progress[exp.id] = idx;
    donatedCount += idx.length;
    if (complete) completedBundles++;
  }

  const remixed = skipped.length >= REMIX_THRESHOLD;
  const unsupported = remixed
    ? 'состав узелков почти весь другой — похоже на смешанные узелки, импорт по позициям дал бы мусор'
    : null;
  if (remixed) {
    for (const k of Object.keys(progress)) delete progress[k];
    for (const k of Object.keys(vault)) delete vault[k];
    donatedCount = 0;
    completedBundles = 0;
  }

  return {
    id: tag(xml, 'uniqueIDForThisGame') || name,
    folder: name,
    file,
    root,
    farmName: tag(xml, 'farmName') || name,
    playerName: playerMatch ? playerMatch[1] : '—',
    season,
    day: parseInt(tag(xml, 'dayOfMonth') || '1', 10),
    weather,
    weatherTomorrow,
    luck,
    year: parseInt(tag(xml, 'year') || '1', 10),
    gameVersion: version,
    bundlesSupported: !unsupported,
    unsupportedReason: unsupported || undefined,
    skipped,
    donatedCount,
    completedBundles,
    progress,
    vault,
  };
}

export function listSaves(roots: string[]): SaveSummary[] {
  const out: SaveSummary[] = [];
  for (const root of roots) {
    let entries: string[];
    try {
      entries = fs.readdirSync(root);
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(root, e);
      try {
        if (!fs.statSync(full).isDirectory()) continue;
      } catch {
        continue;
      }
      const s = readSaveFile(full, root);
      if (s) out.push(s);
    }
  }
  // свежие сверху: год → сезон → день
  out.sort((a, b) => b.year - a.year || b.season - a.season || b.day - a.day);
  return out;
}

export function readSaveById(roots: string[], id: string): SaveSummary | null {
  return listSaves(roots).find((s) => s.id === id) ?? null;
}
