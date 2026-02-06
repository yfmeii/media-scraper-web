/**
 * Server configuration store using wevu's built-in Pinia-like Store.
 * Provides reactive shared state across all pages with localStorage persistence.
 *
 * Uses `utils/config.ts` as the raw storage layer to avoid duplication.
 */
import { computed, defineStore, ref } from 'wevu'
import type { ServerConfig } from '@/utils/config'
import { clearServerConfig, getServerConfig, saveServerConfig } from '@/utils/config'
import { testConnection } from '@/utils/request'

export const useServerStore = defineStore('server', () => {
  // ── State ──
  const config = ref<ServerConfig | null>(getServerConfig())
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
    saveServerConfig(newConfig)
  }

  function clear(): void {
    config.value = null
    connectionStatus.value = 'idle'
    latency.value = 0
    clearServerConfig()
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
