const STORAGE_KEY_SERVER = 'server_config'

export interface ServerConfig {
  url: string
  apiKey?: string
}

export function getServerConfig(): ServerConfig | null {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY_SERVER)
    if (raw) return JSON.parse(raw) as ServerConfig
  }
  catch { /* empty */ }
  return null
}

export function saveServerConfig(config: ServerConfig): void {
  wx.setStorageSync(STORAGE_KEY_SERVER, JSON.stringify(config))
}

export function clearServerConfig(): void {
  wx.removeStorageSync(STORAGE_KEY_SERVER)
}

export function isServerConfigured(): boolean {
  return getServerConfig() !== null
}

export function getApiBaseUrl(): string {
  const config = getServerConfig()
  if (!config) return ''
  const base = config.url.replace(/\/+$/, '')
  return `${base}/api`
}
