import { contextBridge, ipcRenderer } from 'electron';

// Единственный мост между окном и системой. Никакого nodeIntegration:
// окно не может само лазить по диску, только попросить main через эти методы.
const api = {
  isDesktop: true as const,

  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),

  window: {
    minimize: () => ipcRenderer.invoke('win:minimize'),
    toggleMaximize: (): Promise<boolean> => ipcRenderer.invoke('win:toggleMaximize'),
    close: () => ipcRenderer.invoke('win:close'),
  },

  pickFolder: (title: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:pickFolder', title),

  saves: {
    roots: (): Promise<string[]> => ipcRenderer.invoke('saves:roots'),
    addRoot: (p: string): Promise<string[]> => ipcRenderer.invoke('saves:addRoot', p),
    removeRoot: (p: string): Promise<string[]> => ipcRenderer.invoke('saves:removeRoot', p),
    list: (): Promise<unknown[]> => ipcRenderer.invoke('saves:list'),
    read: (id: string): Promise<unknown> => ipcRenderer.invoke('saves:read', id),
    belongings: (id: string): Promise<unknown> => ipcRenderer.invoke('saves:belongings', id),
  },

  game: {
    detect: (): Promise<unknown> => ipcRenderer.invoke('game:detect'),
    mods: (): Promise<unknown[]> => ipcRenderer.invoke('game:mods'),
    runBootstrap: (opts: { mode: 'dry' | 'install'; openNexus?: boolean }): Promise<unknown> =>
      ipcRenderer.invoke('game:runBootstrap', { mode: opts?.mode, openNexus: !!opts?.openNexus }),
    cancelBootstrap: (): Promise<boolean> => ipcRenderer.invoke('game:cancelBootstrap'),
    bootstrapInConsole: (): Promise<unknown> => ipcRenderer.invoke('game:bootstrapInConsole'),
    launch: (mode: string): Promise<unknown> => ipcRenderer.invoke('game:launch', mode),
    bridge: (): Promise<unknown> => ipcRenderer.invoke('game:bridge'),
    icons: (): Promise<Record<string, string>> => ipcRenderer.invoke('game:icons'),
    dropDir: (): Promise<string> => ipcRenderer.invoke('game:dropDir'),
    openDropDir: (): Promise<string> => ipcRenderer.invoke('game:openDropDir'),
    onLine: (cb: (line: string, isErr: boolean) => void) => {
      ipcRenderer.removeAllListeners('bootstrap:line');
      ipcRenderer.on('bootstrap:line', (_e, p: { line: string; isErr: boolean }) => cb(p.line, p.isErr));
    },
    onDone: (cb: (code: number) => void) => {
      ipcRenderer.removeAllListeners('bootstrap:done');
      ipcRenderer.on('bootstrap:done', (_e, p: { code: number }) => cb(p.code));
    },
  },
};

contextBridge.exposeInMainWorld('sdv', api);

export type SdvApi = typeof api;
