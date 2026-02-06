const STORAGE_KEY_SERVER = 'server_config'
export const DEFAULT_IMAGE_PROXY_URL = 'https://wsrv.nl/?url='

export interface ServerConfig {
  url: string
  apiKey?: string
  imageProxyEnabled: boolean
  imageProxyUrl: string
}

function normalizeProxyUrl(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_IMAGE_PROXY_URL
  const trimmed = value.trim()
  return trimmed || DEFAULT_IMAGE_PROXY_URL
}

function normalizeServerConfig(input: Partial<ServerConfig>): ServerConfig | null {
  if (!input || typeof input.url !== 'string') return null
  const url = input.url.trim()
  if (!url) return null

  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : ''

  return {
    url,
    apiKey: apiKey || undefined,
    imageProxyEnabled: input.imageProxyEnabled !== false,
    imageProxyUrl: normalizeProxyUrl(input.imageProxyUrl),
  }
}

export function getServerConfig(): ServerConfig | null {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY_SERVER)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ServerConfig>
      return normalizeServerConfig(parsed)
    }
  }
  catch { /* empty */ }
  return null
}

export function saveServerConfig(config: ServerConfig): void {
  const normalized = normalizeServerConfig(config)
  if (!normalized) return
  wx.setStorageSync(STORAGE_KEY_SERVER, JSON.stringify(normalized))
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
