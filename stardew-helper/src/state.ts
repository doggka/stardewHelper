import type { Bundle, Item, Room, SaveSummary, Season, Weather } from './types';
import { ROOMS } from './data/bundles';

export type Screen = 'welcome' | 'mods' | 'tracker';

/** Прогресс отдельного сейва. Ключ — uniqueIDForThisGame, либо 'manual'. */
export interface Progress {
  checked: Record<string, 1>;
}

export interface AppState {
  screen: Screen;
  /** какой сейв выбран; 'manual' — ручной режим без сейва */
  saveId: string;
  /** сводка выбранного сейва, если он есть */
  save: SaveSummary | null;
  /** показывали ли уже экран модов */
  modsSeen: boolean;

  season: Season;
  day: number;
  weather: Weather;
  tab: string;
  q: string;
  y1guarantee: boolean;
  filters: string[];
  hideDone: boolean;
  locFilter: string | null;

  /** прогресс по каждому сейву отдельно */
  bySave: Record<string, Progress>;
}

const KEY = 'sdv-helper-v2';
const OLD_KEY = 'sdv-bundles-v1';

function defaults(): AppState {
  return {
    screen: 'welcome', saveId: 'manual', save: null, modsSeen: false,
    season: 0, day: 1, weather: 'sun', tab: 'todo', q: '',
    y1guarantee: false, filters: [], hideDone: false, locFilter: null,
    bySave: {},
  };
}

export const S: AppState = defaults();

/** Прогресс текущего сейва. Создаётся лениво. */
export function progress(): Progress {
  let p = S.bySave[S.saveId];
  if (!p) {
    p = { checked: {} };
    S.bySave[S.saveId] = p;
  }
  return p;
}

export function load(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      Object.assign(S, JSON.parse(raw));
    } else {
      // Миграция со старой браузерной версии: её единственный прогресс
      // становится ручным режимом, чтобы ничего не потерялось.
      const old = localStorage.getItem(OLD_KEY);
      if (old) {
        const o = JSON.parse(old);
        S.bySave['manual'] = { checked: o.checked || {} };
        if (typeof o.season === 'number') S.season = o.season;
        if (typeof o.day === 'number') S.day = o.day;
        if (o.weather) S.weather = o.weather;
        if (o.y1guarantee) S.y1guarantee = true;
      }
    }
  } catch {
    /* повреждённое состояние просто игнорируем — лучше чистый старт, чем падение */
  }
  if (!S.day || S.day < 1 || S.day > 28) S.day = 1;
  if (!Array.isArray(S.filters)) S.filters = [];
  if (!S.bySave) S.bySave = {};
  if (!S.saveId) S.saveId = 'manual';
}

export function save(): void {
  localStorage.setItem(KEY, JSON.stringify(S));
}

/* ---- производные структуры по данным узелков ---- */

export const ALL: Item[] = [];

ROOMS.forEach((r: Room) =>
  r.bundles.forEach((b: Bundle) => {
    b.room = r;
    (b.items || []).forEach((it, i) => {
      it.id = b.id + ':' + i;
      it.bundle = b;
      ALL.push(it);
    });
  }),
);

ALL.forEach((it) => {
  it.earliest = it.e !== undefined ? it.e : it.s ? (Math.min.apply(null, it.s as number[]) as Season) : 0;
});

ROOMS.forEach((r: Room) =>
  r.bundles.forEach((b: Bundle) => {
    if (!b.items) {
      b.earliest = 1;
      return;
    }
    const e = b.items.map((i) => i.earliest).sort((a, c) => a - c);
    b.earliest = e[b.slots - 1];
  }),
);

export { ROOMS };
