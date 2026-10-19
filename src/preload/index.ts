import { contextBridge, ipcRenderer } from 'electron'
import type { SkillsApi } from '@shared/types'

const api: SkillsApi = {
  scan: () => ipcRenderer.invoke('skills:scan'),
  getGroups: () => ipcRenderer.invoke('groups:get'),
  saveGroups: (state) => ipcRenderer.invoke('groups:save', state),
  getInstalls: () => ipcRenderer.invoke('installs:get'),
  refreshInstalls: () => ipcRenderer.invoke('installs:refresh'),
  readFile: (id, rel) => ipcRenderer.invoke('skills:read', id, rel),
  saveFile: (id, rel, content) => ipcRenderer.invoke('skills:save', id, rel, content),
  link: (id) => ipcRenderer.invoke('skills:link', id),
  deleteSkill: (id) => ipcRenderer.invoke('skills:delete', id),
  pack: (id) => ipcRenderer.invoke('skills:pack', id),
  openFolder: (id) => ipcRenderer.invoke('skills:openFolder', id),
  openSkillMd: (id) => ipcRenderer.invoke('skills:openSkillMd', id),
  showInExplorer: (id) => ipcRenderer.invoke('skills:showInExplorer', id),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  searchRegistry: (q) => ipcRenderer.invoke('registry:search', q),
  browseRegistry: (path, board, page) => ipcRenderer.invoke('registry:browse', path, board, page),
  installSkill: (source, skillId, withClaude) => ipcRenderer.invoke('install:start', source, skillId, withClaude),
  cancelInstall: () => ipcRenderer.invoke('install:cancel'),
  onInstallEvent: (cb) => {
    const listener = (_e: Electron.IpcRendererEvent, ev: Parameters<typeof cb>[0]): void => cb(ev)
    ipcRenderer.on('install:event', listener)
    return () => ipcRenderer.removeListener('install:event', listener)
  },
  onChanged: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on('skills:changed', listener)
    return () => ipcRenderer.removeListener('skills:changed', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
