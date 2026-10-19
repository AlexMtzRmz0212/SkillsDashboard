import { app, BrowserWindow, ipcMain, nativeTheme, shell } from 'electron'
import { join } from 'path'
import type { Board, GroupsState } from '@shared/types'
import * as actions from './actions'
import { browseRegistry } from './browse'
import { cancelInstall, installSkill, searchRegistry } from './discover'
import { getGroups, saveGroups } from './groups'
import { getInstalls, refreshInstalls } from './installs'
import { scan } from './scanner'
import { watchRoots } from './watcher'

let win: BrowserWindow | null = null

function createWindow(): void {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 560,
    show: false,
    title: 'Skills Dashboard',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#16161a' : '#f7f6f3',
    autoHideMenuBar: true,
    icon: join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.on('ready-to-show', () => win?.show())
  // Links in rendered markdown open in the default browser, never in the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win?.webContents.getURL()) {
      e.preventDefault()
      if (/^https?:\/\//.test(url) && !url.startsWith(process.env.ELECTRON_RENDERER_URL ?? '\0'))
        shell.openExternal(url)
    }
  })
  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
}

app.whenReady().then(() => {
  ipcMain.handle('skills:scan', () => scan())
  ipcMain.handle('groups:get', () => getGroups())
  ipcMain.handle('groups:save', (_e, state: GroupsState) => saveGroups(state))
  ipcMain.handle('installs:get', () => getInstalls())
  ipcMain.handle('installs:refresh', () => refreshInstalls())
  ipcMain.handle('skills:read', (_e, id: string, rel: string) => actions.readFile(id, rel))
  ipcMain.handle('skills:save', (_e, id: string, rel: string, content: string) =>
    actions.saveFile(id, rel, content)
  )
  ipcMain.handle('skills:link', (_e, id: string) => actions.link(id))
  ipcMain.handle('skills:delete', (_e, id: string) => actions.deleteSkill(id))
  ipcMain.handle('skills:pack', (_e, id: string) => actions.pack(id))
  ipcMain.handle('skills:openFolder', (_e, id: string) => actions.openFolder(id))
  ipcMain.handle('skills:openSkillMd', (_e, id: string) => actions.openSkillMd(id))
  ipcMain.handle('skills:showInExplorer', (_e, id: string) => actions.showInExplorer(id))
  ipcMain.handle('app:openExternal', (_e, url: string) => actions.openExternal(url))
  ipcMain.handle('registry:search', (_e, q: string) => searchRegistry(q))
  ipcMain.handle('registry:browse', (_e, path: string[], board: Board, page: number) =>
    browseRegistry(path, board, page)
  )
  ipcMain.handle('install:start', (_e, source: string, skillId: string, withClaude: boolean) =>
    installSkill(source, skillId, !!withClaude, (ev) => win?.webContents.send('install:event', ev))
  )
  ipcMain.handle('install:cancel', () => cancelInstall())

  createWindow()
  const watcher = watchRoots(() => win?.webContents.send('skills:changed'))
  app.on('before-quit', () => {
    watcher.close()
    cancelInstall()
  })
})

app.on('window-all-closed', () => app.quit())
