import { beforeEach, describe, expect, mock, test } from 'bun:test'

type ServerConfig = {
  url: string
  apiKey?: string
  imageProxyEnabled: boolean
  imageProxyUrl: string
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let storedConfig: ServerConfig | null = null

const getServerConfigMock = mock(() => storedConfig)
const saveServerConfigMock = mock((config: ServerConfig) => {
  storedConfig = { ...config }
})
const clearServerConfigMock = mock(() => {
  storedConfig = null
})

let testConnectionImpl: (url: string, apiKey?: string) => Promise<boolean>
const testConnectionMock = mock((url: string, apiKey?: string) => testConnectionImpl(url, apiKey))

mock.module('wevu', () => ({
  ref: <T>(value: T) => ({ value }),
  computed: <T>(getter: () => T) => ({ get value() { return getter() } }),
  defineStore: (_id: string, setup: () => unknown) => setup,
}))

mock.module('@/utils/config', () => ({
  DEFAULT_IMAGE_PROXY_URL: 'https://wsrv.nl/?url=',
  getServerConfig: getServerConfigMock,
  saveServerConfig: saveServerConfigMock,
  clearServerConfig: clearServerConfigMock,
}))

mock.module('@/utils/request', () => ({
  testConnection: testConnectionMock,
}))

const { useServerStore } = await import('./server')

describe('server store', () => {
  beforeEach(() => {
    storedConfig = null
    getServerConfigMock.mockClear()
    saveServerConfigMock.mockClear()
    clearServerConfigMock.mockClear()
    testConnectionMock.mockClear()
    testConnectionImpl = async () => true
  })

  test('initializes from persisted config and computes derived values', () => {
    storedConfig = {
      url: 'https://media.example.com/',
      apiKey: 'secret',
      imageProxyEnabled: false,
      imageProxyUrl: 'https://img.proxy/?url=',
    }

    const store = useServerStore()

    expect(store.config.value?.url).toBe('https://media.example.com/')
    expect(store.isConfigured.value).toBe(true)
    expect(store.serverUrl.value).toBe('https://media.example.com/')
    expect(store.hasApiKey.value).toBe(true)
    expect(store.imageProxyEnabled.value).toBe(false)
    expect(store.imageProxyUrl.value).toBe('https://img.proxy/?url=')
    expect(store.apiBaseUrl.value).toBe('https://media.example.com/api')
  })

  test('save preserves proxy settings and persists normalized config fields', () => {
    storedConfig = {
      url: 'https://old.example.com',
      apiKey: 'old-key',
      imageProxyEnabled: false,
      imageProxyUrl: 'https://proxy.internal/fetch?url=',
    }

    const store = useServerStore()
    store.save('https://next.example.com/', '  new-key  ')

    expect(store.config.value).toEqual({
      url: 'https://next.example.com/',
      apiKey: '  new-key  ',
      imageProxyEnabled: false,
      imageProxyUrl: 'https://proxy.internal/fetch?url=',
    })
    expect(saveServerConfigMock).toHaveBeenCalledTimes(1)
    expect(storedConfig).toEqual(store.config.value)
  })

  test('saveImageProxy trims blank proxy values back to default', () => {
    storedConfig = {
      url: 'https://media.example.com',
      apiKey: undefined,
      imageProxyEnabled: true,
      imageProxyUrl: 'https://custom.proxy/?url=',
    }

    const store = useServerStore()
    store.saveImageProxy(false, '   ')

    expect(store.imageProxyEnabled.value).toBe(false)
    expect(store.imageProxyUrl.value).toBe('https://wsrv.nl/?url=')
    expect(saveServerConfigMock).toHaveBeenCalledWith({
      url: 'https://media.example.com',
      apiKey: undefined,
      imageProxyEnabled: false,
      imageProxyUrl: 'https://wsrv.nl/?url=',
    })
  })

  test('clear resets state and removes persisted config', () => {
    storedConfig = {
      url: 'https://media.example.com',
      apiKey: 'key',
      imageProxyEnabled: true,
      imageProxyUrl: 'https://wsrv.nl/?url=',
    }

    const store = useServerStore()
    store.connectionStatus.value = 'online'
    store.latency.value = 123

    store.clear()

    expect(store.config.value).toBeNull()
    expect(store.connectionStatus.value).toBe('idle')
    expect(store.latency.value).toBe(0)
    expect(clearServerConfigMock).toHaveBeenCalledTimes(1)
    expect(storedConfig).toBeNull()
  })

  test('reuses in-flight connection checks and updates state once', async () => {
    storedConfig = {
      url: 'https://media.example.com/',
      apiKey: 'api-key',
      imageProxyEnabled: true,
      imageProxyUrl: 'https://wsrv.nl/?url=',
    }
    const pending = deferred<boolean>()
    testConnectionImpl = async () => pending.promise

    const store = useServerStore()
    const first = store.checkConnection()
    const second = store.checkConnection()

    expect(store.connectionStatus.value).toBe('checking')
    expect(testConnectionMock).toHaveBeenCalledTimes(1)
    expect(testConnectionMock).toHaveBeenCalledWith('https://media.example.com/', 'api-key')

    pending.resolve(true)

    await expect(first).resolves.toBe(true)
    await expect(second).resolves.toBe(true)
    expect(store.connectionStatus.value).toBe('online')
    expect(store.latency.value).toBeGreaterThanOrEqual(0)
  })

  test('marks offline when no config or when connection test fails', async () => {
    const storeWithoutConfig = useServerStore()
    await expect(storeWithoutConfig.checkConnection()).resolves.toBe(false)
    expect(storeWithoutConfig.connectionStatus.value).toBe('offline')
    expect(testConnectionMock).not.toHaveBeenCalled()

    storedConfig = {
      url: 'https://media.example.com',
      apiKey: 'key',
      imageProxyEnabled: true,
      imageProxyUrl: 'https://wsrv.nl/?url=',
    }
    testConnectionImpl = async () => {
      throw new Error('timeout')
    }

    const failingStore = useServerStore()
    failingStore.latency.value = 88

    await expect(failingStore.checkConnection()).resolves.toBe(false)
    expect(failingStore.connectionStatus.value).toBe('offline')
    expect(failingStore.latency.value).toBe(0)
  })

  test('allows a new connection check after the previous one settles', async () => {
    storedConfig = {
      url: 'https://media.example.com',
      apiKey: undefined,
      imageProxyEnabled: true,
      imageProxyUrl: 'https://wsrv.nl/?url=',
    }

    let attempt = 0
    testConnectionImpl = async () => {
      attempt += 1
      return attempt === 2
    }

    const store = useServerStore()

    await expect(store.checkConnection()).resolves.toBe(false)
    expect(store.connectionStatus.value).toBe('offline')

    await expect(store.checkConnection()).resolves.toBe(true)
    expect(testConnectionMock).toHaveBeenCalledTimes(2)
    expect(store.connectionStatus.value).toBe('online')
  })
})
