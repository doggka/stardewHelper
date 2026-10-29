import type { Belongings, BridgeState, GameInfo, ModInfo, SaveSummary } from './types';

/** Мост в процесс Electron. В обычном браузере его нет — тогда работаем вручную. */
export interface Bridge {
  isDesktop: true;
  openExternal(url: string): Promise<void>;
  window: {
    minimize(): Promise<void>;
    toggleMaximize(): Promise<boolean>;
    close(): Promise<void>;
  };
  pickFolder(title: string): Promise<string | null>;
  saves: {
    roots(): Promise<string[]>;
    addRoot(p: string): Promise<string[]>;
    removeRoot(p: string): Promise<string[]>;
    list(): Promise<SaveSummary[]>;
    read(id: string): Promise<SaveSummary | null>;
    belongings(id: string): Promise<Belongings | null>;
  };
  game: {
    detect(): Promise<GameInfo>;
    mods(): Promise<ModInfo[]>;
    runBootstrap(opts: { mode: 'dry' | 'install'; openNexus?: boolean }): Promise<{ started: boolean; error?: string }>;
    cancelBootstrap(): Promise<boolean>;
    bootstrapInConsole(): Promise<{ started: boolean; error?: string }>;
    launch(mode: string): Promise<{ ok: boolean; error?: string; cmd?: string }>;
    bridge(): Promise<BridgeState | null>;
    icons(): Promise<Record<string, string>>;
    dropDir(): Promise<string>;
    openDropDir(): Promise<string>;
    onLine(cb: (line: string, isErr: boolean) => void): void;
    onDone(cb: (code: number) => void): void;
  };
}

declare global {
  interface Window {
    sdv?: Bridge;
  }
}

// Дев-заглушка: позволяет открыть экраны онбординга в обычном браузере
// (http://localhost:5174/?mock) и посмотреть их, не собирая приложение.
// В продакшен-сборку не попадает — блок вырезается по import.meta.env.DEV.
if (import.meta.env.DEV && location.search.includes('mock') && !window.sdv) {
  const mkSave = (
    id: string, farmName: string, playerName: string,
    season: 0 | 1 | 2 | 3, day: number, year: number,
    gameVersion: string | null, completedBundles: number, skipped: string[],
  ): SaveSummary => ({
    id, folder: farmName, file: '', root: 'MOCK',
    farmName, playerName, season, day, year, gameVersion,
    weather: 'sun', weatherTomorrow: 'rain', luck: 0.08,
    farm: { barn: 3, coop: 2, greenhouse: false, professions: [1, 4],
      animals: [{ type: 'Pig', hearts: 900 }] },
    bundlesSupported: true, skipped, donatedCount: 0, completedBundles,
    progress: {}, vault: {},
  });

  window.sdv = {
    isDesktop: true,
    openExternal: async (u) => { console.log('openExternal', u); },
    window: { minimize: async () => {}, toggleMaximize: async () => false, close: async () => {} },
    pickFolder: async () => null,
    saves: {
      roots: async () => ['MOCK'],
      addRoot: async () => ['MOCK'],
      removeRoot: async () => ['MOCK'],
      list: async () => [
        mkSave('273501798', 'JuicyPussy', 'Mel', 2, 21, 2, '1.5.4', 29, ['animal']),
        mkSave('117374873', 'Dogg', 'Doggka', 2, 1, 2, null, 0, ['animal']),
        mkSave('159901889', 'Podkabluk', 'Volodya', 1, 8, 1, null, 1, ['animal']),
        mkSave('452028593', 'Пивзавод', 'Андрей', 0, 6, 1, '1.6.15', 0, []),
      ],
      read: async () => null,
      belongings: async () => ({
        items: [
          { id: '24', qty: 3, quality: 0, name: 'Parsnip', cat: -75, price: 35,
            where: 'chest', loc: 'Farm', x: 59, y: 17 },
          { id: '190', qty: 1, quality: 2, name: 'Cauliflower', cat: -75, price: 175,
            where: 'bag' },
          { id: '72', qty: 1, quality: 0, name: 'Diamond', cat: -2, price: 750,
            where: 'chest', loc: 'Farm', x: 59, y: 17 },
        ],
        crops: [{ id: '262', loc: 'Farm', x: 64, y: 20, days: 4 }],
      }),
    },
    game: {
      detect: async () => ({ path: 'F:\\SteamLibrary\\steamapps\\common\\Stardew Valley', smapiInstalled: false, modsPath: null }),
      // в заглушке описания не важны: проверяется раскладка, а не текст
      mods: async () => ([
        ['SMAPI', 'SMAPI', false, null],
        ['NPCMapLocations', 'NPC Map Locations', false, null],
        ['UIInfoSuite2', 'UI Info Suite 2', true, '2.3.7'],
        ['LookupAnything', 'Lookup Anything', false, null],
        ['DataLayers', 'Data Layers', false, null],
        ['Automate', 'Automate', false, null],
        ['ChestsAnywhere', 'Chests Anywhere', false, null],
      ] as const).map(([key, name, installed, version]) => ({
        key, name, installed, version,
        what: 'описание из заглушки', why: 'описание из заглушки', url: 'https://smapi.io/',
      })),
      runBootstrap: async () => ({ started: false, error: 'заглушка' }),
      cancelBootstrap: async () => false,
      bootstrapInConsole: async () => ({ started: false, error: 'заглушка' }),
      launch: async (m) => ({ ok: true, cmd: 'mock:' + m }),
      // в браузерной заглушке иконок нет — ровно как без мода
      icons: async () => ({}),
      bridge: async () => ({
        saveId: '452028593', day: 11, season: 'spring', year: 1, weather: 'sun',
        cartPresent: true,
        cart: [
          { name: 'Семена красной капусты', price: 650, stock: 5 },
          { name: 'Сморчок', price: 450, stock: 3 },
          { name: 'Деревянный забор', price: 120, stock: 20 },
        ],
      }),
      dropDir: async () => 'C:\\mock\\drop',
      openDropDir: async () => '',
      onLine: () => {},
      onDone: () => {},
    },
  };
}

export const bridge: Bridge | null = window.sdv ?? null;
export const isDesktop = !!bridge;

/** Открыть ссылку снаружи: в приложении — системным браузером, иначе обычной вкладкой. */
export function openExternal(url: string): void {
  if (bridge) void bridge.openExternal(url);
  else window.open(url, '_blank', 'noopener');
}
