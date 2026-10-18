import type { GameInfo, ModInfo, SaveSummary } from './types';

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
  };
  game: {
    detect(): Promise<GameInfo>;
    mods(): Promise<ModInfo[]>;
    runBootstrap(): Promise<{ started: boolean; error?: string }>;
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
    },
    game: {
      detect: async () => ({ path: 'F:\\SteamLibrary\\steamapps\\common\\Stardew Valley', smapiInstalled: false, modsPath: null }),
      mods: async () => [
        { key: 'SMAPI', name: 'SMAPI', installed: false, version: null },
        { key: 'NPCMapLocations', name: 'NPC Map Locations', installed: false, version: null },
        { key: 'UIInfoSuite2', name: 'UI Info Suite 2', installed: true, version: '2.3.7' },
        { key: 'LookupAnything', name: 'Lookup Anything', installed: false, version: null },
        { key: 'DataLayers', name: 'Data Layers', installed: false, version: null },
      ],
      runBootstrap: async () => ({ started: false, error: 'заглушка' }),
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
