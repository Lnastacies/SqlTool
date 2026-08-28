declare module 'electron' {
  export const app: App
  export const BrowserWindow: typeof BrowserWindow
  export const ipcMain: IpcMain
  export const ipcRenderer: IpcRenderer
  export const contextBridge: ContextBridge

  interface App {
    whenReady(): Promise<void>
    on(event: string, listener: (...args: any[]) => void): void
    quit(): void
    getAppPath(): string
    getVersion(): string
    getPath(name: string): string
  }

  interface BrowserWindowConstructorOptions {
    width?: number
    height?: number
    minWidth?: number
    minHeight?: number
    frame?: boolean
    title?: string
    webPreferences?: WebPreferences
  }

  interface WebPreferences {
    preload?: string
    contextIsolation?: boolean
    nodeIntegration?: boolean
  }

  class BrowserWindow {
    constructor(options?: BrowserWindowConstructorOptions)
    loadURL(url: string): void
    loadFile(filePath: string): void
    on(event: string, listener: (...args: any[]) => void): void
    static getAllWindows(): BrowserWindow[]
    close(): void
  }

  interface IpcMain {
    handle(channel: string, listener: (...args: any[]) => Promise<any>): void
  }

  interface IpcRenderer {
    invoke(channel: string, ...args: any[]): Promise<any>
  }

  interface ContextBridge {
    exposeInMainWorld(apiKey: string, api: any): void
  }
}
