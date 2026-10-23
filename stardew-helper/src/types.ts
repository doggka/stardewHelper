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
  /** то же, но разобранное: показываем только невыполненный шаг */
  need?: Need;
  /**
   * Предупреждение, которое нужно только пока цепочка не собрана.
   * «Начинай копить с весны» бессмысленно, когда хлев построен и свинья
   * куплена, а `warn` остаётся верным всегда.
   */
  warnSetup?: string;
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

/**
 * Цепочка «постройка → животное → сердечки» в разобранном виде.
 *
 * Раньше это была одна строка текста, и она не менялась: «элитный хлев +
 * свинья» висело и после того, как хлев построен, а свинья куплена. Совет
 * про уже сделанное — шум, который прячет настоящую причину.
 */
export interface Need {
  /** нужен хлев не ниже этого уровня */
  barn?: number;
  /** нужен курятник не ниже этого уровня */
  coop?: number;
  /** годные типы животных, как их называет игра */
  animal?: string[];
  /** по-русски, для текста подсказки */
  animalRu?: string;
  /** крупный продукт идёт только при высокой дружбе */
  hearts?: boolean;
  /** что сказать, когда вся цепочка уже выполнена */
  then?: string;
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
/** Состояние фермы: что построено и кто живёт. */
export interface FarmState {
  /** лучший построенный хлев: 0 нет, 1 обычный, 2 большой, 3 элитный */
  barn: number;
  /** то же про курятник */
  coop: number;
  /** дружба 0–1000 у каждого животного */
  animals: { type: string; hearts: number }[];
  /** теплица именно починена, а не просто лежит в развалинах на карте */
  greenhouse: boolean;
}

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
  /** погода в долине на сегодня — только «мокро или нет» */
  weather: Weather;
  /** игра знает погоду заранее; это решение на сегодняшний вечер */
  weatherTomorrow: Weather;
  /** удача дня, −0.1…0.1 — то, что духи говорят по телевизору */
  luck: number;
  /** постройки и живность — чтобы подсказки не советовали уже сделанное */
  farm: FarmState;
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
  /** −0.1…0.1 */
  luck?: number;
  weatherTomorrow?: string;
  /** сколько грядок с посаженным ждёт полива; живое значение, не «на утро» */
  needWater?: number;
  cartPresent: boolean;
  /** кэшированное поле игры рядом с вычисленным — чтобы расхождение было видно */
  cartFlag?: boolean;
  cart: { name: string; price: number; stock: number }[];
}

export interface GameInfo {
  path: string | null;
  smapiInstalled: boolean;
  modsPath: string | null;
}
