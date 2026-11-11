import { contextBridge, ipcRenderer } from 'electron'
import { INVOKE_CHANNELS, EVENT_CHANNELS } from '@shared/ipc'

const invokeSet = new Set<string>(INVOKE_CHANNELS)
const eventSet = new Set<string>(EVENT_CHANNELS)

contextBridge.exposeInMainWorld('api', {
  invoke(channel: string, payload?: unknown) {
    if (!invokeSet.has(channel)) return Promise.reject(new Error(`Ruxsat etilmagan kanal: ${channel}`))
    return ipcRenderer.invoke(channel, payload)
  },
  on(channel: string, cb: (data: unknown) => void) {
    if (!eventSet.has(channel)) throw new Error(`Ruxsat etilmagan kanal: ${channel}`)
    const h = (_e: unknown, data: unknown) => cb(data)
    ipcRenderer.on(channel, h)
    return () => ipcRenderer.removeListener(channel, h)
  },
  platform: process.platform
})
