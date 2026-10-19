export type Season = 0 | 1 | 2 | 3;
export type Weather = 'sun' | 'rain';
export type Level = 'now' | 'cond' | 'later' | 'cart' | 'past';
export type FilterKey = Level | 'last';

/** Предмет внутри узелка. Поля намеренно короткие — так данные читаются компактно. */
export interface Item {
  /** название */
  n: string;
  /** количество */
  q?: number;
  /** нужно золотое качество */
  gold?: 1;
  /** сезоны; null — круглый год */
  s?: Season[] | null;
  /** погода */
  w?: Weather;
  /** время суток */
  t?: string;
  /** условие или цепочка подготовки */
  c?: string;
  /** локация по умолчанию */
  loc?: string;
  /** переопределение локации на конкретный сезон */
  locS?: Record<number, string>;
  /** где добывать, текст с вики */
  src?: string;
  /** предупреждение про первый год */
  warn?: string;
  /** есть круглогодичный альтернативный источник */
  alsoAny?: 1;
  /** торговка не продаёт принципиально */
  noCart?: 1;
  /** фруктовое дерево: растёт 28 дней */
  tree?: 1;
  /** реалистично самый ранний сезон */
  e?: Season;
  /** сколько дней растёт культура — чтобы считать, успеет ли до конца сезона */
  grow?: number;

  // проставляются при инициализации
  id: string;
  bundle: Bundle;
  earliest: Season;
}

/** Узелок. slots — сколько предметов реально надо сдать. */
export interface Bundle {
  id: string;
  /** индекс узелка в файле сохранения */
  saveKey: number;
  name: string;
  slots: number;
  reward: string;
  note?: string;
  items?: Item[];
  /** для узелков Сейфа — сумма */
  gold?: number;

  room: Room;
  earliest: Season;
}

export interface Room {
  id: string;
  name: string;
  reward: string;
  open?: string;
  caution?: string;
  /** комната Сейфа — платежи вместо предметов */
  vault?: 1;
  /** не входит в зачёт 30 узелков */
  extra?: 1;
  bundles: Bundle[];
}

export interface Loc {
  n: string;
  pin: [number, number];
  how: string;
  wiki: string;
  img?: string;
  /** чем заперт доступ */
  gate?: string;
  /** локация вне карты долины */
  offmap?: string;
}

export interface Status {
  lvl: Level;
  cond: string[];
  last: boolean;
  /**
   * Есть условие, которое сегодня не выполнить: не та погода, закрытый
   * доступ, особое требование. Без него условия остаются выполнимыми —
   * дождаться времени суток и идти. Для подсветки это разные советы.
   */
  hard: boolean;
}

/** Что уже есть у игрока. Читается из сейва, сверяется строго по itemId. */
export interface HeldItem {
  id: string;
  qty: number;
  quality: number;
  where: 'bag' | 'chest';
  loc?: string;
  x?: number;
  y?: number;
}

export interface GrowingCrop {
  id: string;
  loc: string;
  x: number;
  y: number;
  /** 0 — можно собирать уже сегодня */
  days: number;
}

export interface Belongings {
  items: HeldItem[];
  crops: GrowingCrop[];
}

export interface CartInfo {
  price?: string;
  no?: string;
}

/** Сводка по сохранению — приходит из процесса Electron. */
export interface SaveSummary {
  id: string;
  folder: string;
  file: string;
  root: string;
  farmName: string;
  playerName: string;
  season: Season;
  day: number;
  year: number;
  gameVersion: string | null;
  /** можно ли импортировать прогресс узелков */
  bundlesSupported: boolean;
  unsupportedReason?: string;
  /** узелки, чей состав в сейве не совпал с нашим — пропущены при импорте */
  skipped: string[];
  donatedCount: number;
  completedBundles: number;
  /** id нашего узелка -> индексы сданных предметов */
  progress: Record<string, number[]>;
  /** id узелка Сейфа -> оплачен */
  vault: Record<string, boolean>;
}

export interface ModInfo {
  key: string;
  name: string;
  installed: boolean;
  version: string | null;
}

/** Что выгрузил мод-мостик. Null, если мода нет или он ещё не писал. */
export interface BridgeState {
  saveId: string;
  day: number;
  season: string;
  year: number;
  weather: string;
  cartPresent: boolean;
  cart: { name: string; price: number; stock: number }[];
}

export interface GameInfo {
  path: string | null;
  smapiInstalled: boolean;
  modsPath: string | null;
}
