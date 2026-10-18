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
  },

  game: {
    detect: (): Promise<unknown> => ipcRenderer.invoke('game:detect'),
    mods: (): Promise<unknown[]> => ipcRenderer.invoke('game:mods'),
    runBootstrap: (): Promise<unknown> => ipcRenderer.invoke('game:runBootstrap'),
  },
};

contextBridge.exposeInMainWorld('sdv', api);

export type SdvApi = typeof api;
