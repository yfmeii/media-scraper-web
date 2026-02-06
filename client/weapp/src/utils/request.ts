import { getApiBaseUrl, getServerConfig } from './config'

interface RequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: Record<string, unknown>
  header?: Record<string, string>
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  stats?: unknown
  taskId?: string
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const config = getServerConfig()
  if (config && config.apiKey) {
    headers['X-API-Key'] = config.apiKey
  }
  return headers
}

export function request<T = unknown>(options: RequestOptions): Promise<ApiResponse<T>> {
  const baseUrl = getApiBaseUrl()
  if (!baseUrl) {
    return Promise.reject(new Error('服务器未配置'))
  }

  const url = options.url.startsWith('http') ? options.url : `${baseUrl}${options.url}`

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: options.method || 'GET',
      data: options.data,
      header: { ...buildHeaders(), ...options.header },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data as ApiResponse<T>)
        }
        else {
          const errData = res.data as ApiResponse
          const msg = (errData && errData.error) || `请求失败 (${res.statusCode})`
          wx.showToast({ title: msg, icon: 'none', duration: 2000 })
          reject(new Error(msg))
        }
      },
      fail(err) {
        const msg = err.errMsg || '网络错误'
        wx.showToast({ title: msg, icon: 'none', duration: 2000 })
        reject(new Error(msg))
      },
    })
  })
}

export function get<T = unknown>(path: string): Promise<ApiResponse<T>> {
  return request<T>({ url: path, method: 'GET' })
}

export function post<T = unknown>(path: string, data?: Record<string, unknown>): Promise<ApiResponse<T>> {
  return request<T>({ url: path, method: 'POST', data })
}

export function testConnection(url: string, apiKey?: string): Promise<boolean> {
  const base = url.replace(/\/+$/, '')
  return new Promise((resolve) => {
    wx.request({
      url: `${base}/api/media/stats`,
      method: 'GET',
      header: apiKey ? { 'X-API-Key': apiKey } : {},
      timeout: 5000,
      success(res) {
        resolve(res.statusCode >= 200 && res.statusCode < 300)
      },
      fail() {
        resolve(false)
      },
    })
  })
}

export function getPosterUrl(posterPath: string | undefined): string {
  if (!posterPath) return ''
  if (posterPath.startsWith('http')) return posterPath

  const apiBase = getApiBaseUrl()
  if (!apiBase) return ''

  // Server scanner returns "/api/media/poster?path=..." directly.
  // For miniapp we need to prepend server origin instead of wrapping it again.
  const serverBase = apiBase.replace(/\/api\/?$/, '')
  if (posterPath.startsWith('/api/')) {
    return `${serverBase}${posterPath}`
  }
  if (posterPath.startsWith('/')) {
    return `${serverBase}${posterPath}`
  }

  // Fallback: when posterPath is a raw filesystem path.
  return `${apiBase}/media/poster?path=${encodeURIComponent(posterPath)}`
}
