/**
 * Server configuration store using wevu's built-in Pinia-like Store.
 * Provides reactive shared state across all pages with localStorage persistence.
 */
import { computed, defineStore, ref } from 'wevu'
import { testConnection } from '@/utils/request'

const STORAGE_KEY = 'server_config'

interface ServerConfig {
  url: string
  apiKey?: string
}

function readConfig(): ServerConfig | null {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ServerConfig
  }
  catch { /* empty */ }
  return null
}

function writeConfig(config: ServerConfig | null): void {
  if (config) {
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(config))
  }
  else {
    wx.removeStorageSync(STORAGE_KEY)
  }
}

export const useServerStore = defineStore('server', () => {
  // ── State ──
  const config = ref<ServerConfig | null>(readConfig())
  const connectionStatus = ref<'idle' | 'checking' | 'online' | 'offline'>('idle')
  const latency = ref(0)

  // ── Getters ──
  const isConfigured = computed(() => config.value !== null)
  const serverUrl = computed(() => config.value ? config.value.url : '')
  const hasApiKey = computed(() => !!(config.value && config.value.apiKey))

  const apiBaseUrl = computed(() => {
    if (!config.value) return ''
    const base = config.value.url.replace(/\/+$/, '')
    return `${base}/api`
  })

  // ── Actions ──
  function save(url: string, apiKey?: string): void {
    const newConfig: ServerConfig = { url, apiKey }
    config.value = newConfig
    writeConfig(newConfig)
  }

  function clear(): void {
    config.value = null
    connectionStatus.value = 'idle'
    latency.value = 0
    writeConfig(null)
  }

  async function checkConnection(): Promise<boolean> {
    if (!config.value) {
      connectionStatus.value = 'offline'
      return false
    }
    connectionStatus.value = 'checking'
    const start = Date.now()
    try {
      const ok = await testConnection(config.value.url, config.value.apiKey)
      latency.value = Date.now() - start
      connectionStatus.value = ok ? 'online' : 'offline'
      return ok
    }
    catch {
      latency.value = 0
      connectionStatus.value = 'offline'
      return false
    }
  }

  return {
    config,
    connectionStatus,
    latency,
    isConfigured,
    serverUrl,
    hasApiKey,
    apiBaseUrl,
    save,
    clear,
    checkConnection,
  }
})
