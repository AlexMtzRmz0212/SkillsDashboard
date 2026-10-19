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
  pack: (id) => ipcRenderer.invoke('skills:pack', id),
  openFolder: (id) => ipcRenderer.invoke('skills:openFolder', id),
  openSkillMd: (id) => ipcRenderer.invoke('skills:openSkillMd', id),
  showInExplorer: (id) => ipcRenderer.invoke('skills:showInExplorer', id),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  onChanged: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on('skills:changed', listener)
    return () => ipcRenderer.removeListener('skills:changed', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)
