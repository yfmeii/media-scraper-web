import { beforeEach, describe, expect, mock, test } from 'bun:test'

type WxRequestOptions = {
  url: string
  method?: string
  data?: Record<string, unknown>
  header?: Record<string, string>
  timeout?: number
  success?: (response: { statusCode: number, data?: unknown }) => void
  fail?: (error: { errMsg?: string }) => void
}

let storage = new Map<string, string>()
let requestImpl: (options: WxRequestOptions) => void
const toastCalls: Array<Record<string, unknown>> = []

const wxMock = {
  request: mock((options: WxRequestOptions) => requestImpl(options)),
  showToast: mock((options: Record<string, unknown>) => {
    toastCalls.push(options)
  }),
  getStorageSync: mock((key: string) => storage.get(key) ?? ''),
  setStorageSync: mock((key: string, value: string) => {
    storage.set(key, value)
  }),
  removeStorageSync: mock((key: string) => {
    storage.delete(key)
  }),
}

Object.assign(globalThis, { wx: wxMock })

const requestModule = await import('./request')

describe('weapp request utilities', () => {
  beforeEach(() => {
    storage = new Map()
    toastCalls.length = 0
    wxMock.request.mockClear()
    wxMock.showToast.mockClear()
    wxMock.getStorageSync.mockClear()
    wxMock.setStorageSync.mockClear()
    wxMock.removeStorageSync.mockClear()
    requestImpl = ({ success }) => {
      success?.({ statusCode: 200, data: { success: true } })
    }
  })

  test('rejects when server config is missing', async () => {
    await expect(requestModule.request({ url: '/media/stats' })).rejects.toThrow('服务器未配置')
    expect(wxMock.request).not.toHaveBeenCalled()
  })

  test('builds base url, adds API key header, and lets explicit headers override defaults', async () => {
    storage.set('server_config', JSON.stringify({
      url: 'https://media.example.com/',
      apiKey: 'secret-key',
      imageProxyEnabled: true,
      imageProxyUrl: 'https://wsrv.nl/?url=',
    }))

    let captured!: WxRequestOptions
    requestImpl = (options) => {
      captured = options
      options.success?.({
        statusCode: 200,
        data: { success: true, data: { ok: true } },
      })
    }

    await expect(requestModule.request({
      url: '/tasks',
      method: 'POST',
      data: { id: 1 },
      header: {
        'Content-Type': 'text/plain',
        'X-Trace-Id': 'trace-1',
      },
    })).resolves.toEqual({ success: true, data: { ok: true } })

    expect(captured.url).toBe('https://media.example.com/api/tasks')
    expect(captured.method).toBe('POST')
    expect(captured.data).toEqual({ id: 1 })
    expect(captured.header).toEqual({
      'Content-Type': 'text/plain',
      'X-API-Key': 'secret-key',
      'X-Trace-Id': 'trace-1',
    })
  })

  test('preserves absolute urls without prefixing the api base', async () => {
    storage.set('server_config', JSON.stringify({
      url: 'https://media.example.com',
      imageProxyEnabled: true,
      imageProxyUrl: 'https://wsrv.nl/?url=',
    }))

    let capturedUrl = ''
    requestImpl = (options) => {
      capturedUrl = options.url
      options.success?.({ statusCode: 200, data: { success: true } })
    }

    await requestModule.request({ url: 'https://other.example.com/ping' })
    expect(capturedUrl).toBe('https://other.example.com/ping')
  })

  test('shows toast and rejects with server error messages for non-2xx responses', async () => {
    storage.set('server_config', JSON.stringify({
      url: 'https://media.example.com',
      imageProxyEnabled: true,
      imageProxyUrl: 'https://wsrv.nl/?url=',
    }))

    requestImpl = ({ success }) => {
      success?.({ statusCode: 500, data: { success: false, error: 'boom' } })
    }

    await expect(requestModule.get('/tasks')).rejects.toThrow('boom')
    expect(toastCalls).toEqual([{ title: 'boom', icon: 'none', duration: 2000 }])
  })

  test('falls back to status code and network messages when request fails', async () => {
    storage.set('server_config', JSON.stringify({
      url: 'https://media.example.com',
      imageProxyEnabled: true,
      imageProxyUrl: 'https://wsrv.nl/?url=',
    }))

    requestImpl = ({ success }) => {
      success?.({ statusCode: 404, data: { success: false } })
    }
    await expect(requestModule.post('/missing')).rejects.toThrow('请求失败 (404)')

    requestImpl = ({ fail }) => {
      fail?.({ errMsg: 'request:fail timeout' })
    }
    await expect(requestModule.get('/timeout')).rejects.toThrow('request:fail timeout')

    expect(toastCalls).toEqual([
      { title: '请求失败 (404)', icon: 'none', duration: 2000 },
      { title: 'request:fail timeout', icon: 'none', duration: 2000 },
    ])
  })

  test('testConnection normalizes url, forwards api key, and returns false on failure', async () => {
    let firstCall!: WxRequestOptions
    requestImpl = (options) => {
      firstCall = options
      options.success?.({ statusCode: 204 })
    }

    await expect(requestModule.testConnection('https://media.example.com///', 'token')).resolves.toBe(true)
    expect(firstCall.url).toBe('https://media.example.com/api/media/stats')
    expect(firstCall.method).toBe('GET')
    expect(firstCall.timeout).toBe(5000)
    expect(firstCall.header).toEqual({ 'X-API-Key': 'token' })

    requestImpl = ({ fail }) => {
      fail?.({ errMsg: 'request:fail' })
    }
    await expect(requestModule.testConnection('https://media.example.com')).resolves.toBe(false)
  })

  test('rewrites poster urls through the configured image proxy patterns', () => {
    storage.set('server_config', JSON.stringify({
      url: 'https://media.example.com/',
      imageProxyEnabled: true,
      imageProxyUrl: 'https://images.example.com/fetch?u={url}',
    }))

    expect(requestModule.getPosterUrl('https://image.tmdb.org/t/p/w500/poster.jpg'))
      .toBe('https://images.example.com/fetch?u=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Fw500%2Fposter.jpg')

    storage.set('server_config', JSON.stringify({
      url: 'https://media.example.com/',
      imageProxyEnabled: true,
      imageProxyUrl: 'https://images.example.com/%s',
    }))
    expect(requestModule.getPosterUrl('https://image.tmdb.org/t/p/original/backdrop.jpg'))
      .toBe('https://images.example.com/https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Foriginal%2Fbackdrop.jpg')

    storage.set('server_config', JSON.stringify({
      url: 'https://media.example.com/',
      imageProxyEnabled: true,
      imageProxyUrl: 'https://images.example.com/proxy',
    }))
    expect(requestModule.getPosterUrl('https://image.tmdb.org/t/p/w92/thumb.jpg'))
      .toBe('https://images.example.com/proxy?url=https%3A%2F%2Fimage.tmdb.org%2Ft%2Fp%2Fw92%2Fthumb.jpg')
  })

  test('skips proxy rewriting when disabled or already proxied and expands local poster paths', () => {
    storage.set('server_config', JSON.stringify({
      url: 'https://media.example.com///',
      imageProxyEnabled: false,
      imageProxyUrl: 'https://images.example.com/proxy?url=',
    }))

    expect(requestModule.getPosterUrl('https://image.tmdb.org/t/p/w342/poster.jpg'))
      .toBe('https://image.tmdb.org/t/p/w342/poster.jpg')

    storage.set('server_config', JSON.stringify({
      url: 'https://media.example.com',
      imageProxyEnabled: true,
      imageProxyUrl: 'https://images.example.com/proxy?url=',
    }))

    expect(requestModule.getPosterUrl('https://wsrv.nl/?url=https%3A%2F%2Fimage.tmdb.org%2Fx.jpg'))
      .toBe('https://wsrv.nl/?url=https%3A%2F%2Fimage.tmdb.org%2Fx.jpg')
    expect(requestModule.getPosterUrl('/api/media/poster?path=%2Ftv%2FAndor%2Fposter.jpg'))
      .toBe('https://media.example.com/api/media/poster?path=%2Ftv%2FAndor%2Fposter.jpg')
    expect(requestModule.getPosterUrl('/covers/andor.jpg'))
      .toBe('https://media.example.com/covers/andor.jpg')
    expect(requestModule.getPosterUrl('mnt/media/TV/Andor/poster.jpg'))
      .toBe('https://media.example.com/api/media/poster?path=mnt%2Fmedia%2FTV%2FAndor%2Fposter.jpg')
    expect(requestModule.getPosterUrl(undefined)).toBe('')
  })
})
