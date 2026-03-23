import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { MediaFile } from '@media-scraper/shared'

const baseFiles: MediaFile[] = [
  {
    path: '/inbox/Show.S01E01.mkv',
    name: 'Show.S01E01.mkv',
    relativePath: 'Show.S01E01.mkv',
    size: 1,
    kind: 'tv',
    parsed: { title: 'Show', season: 1, episode: 1 },
    hasNfo: false,
    isProcessed: false,
  },
  {
    path: '/inbox/Show.S01E02.mkv',
    name: 'Show.S01E02.mkv',
    relativePath: 'Show.S01E02.mkv',
    size: 1,
    kind: 'tv',
    parsed: { title: 'Show', season: 1, episode: 2 },
    hasNfo: false,
    isProcessed: false,
  },
  {
    path: '/inbox/Show.S01E03.mkv',
    name: 'Show.S01E03.mkv',
    relativePath: 'Show.S01E03.mkv',
    size: 1,
    kind: 'tv',
    parsed: { title: 'Show', season: 1, episode: 3 },
    hasNfo: false,
    isProcessed: false,
  },
]

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

async function flushAsyncWork() {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const { useInboxBatchActions } = await import('./useInboxBatchActions')

describe('useInboxBatchActions', () => {
  const confirmMock = mock(async () => true)
  const showToastMock = mock(() => {})
  const reloadMock = mock(async () => {})
  const clearSelectionMock = mock(() => {})

  beforeEach(() => {
    confirmMock.mockClear()
    confirmMock.mockImplementation(async () => true)
    showToastMock.mockClear()
    reloadMock.mockClear()
    clearSelectionMock.mockClear()
  })

  test('returns early when no files are selected', async () => {
    const batch = useInboxBatchActions({
      confirm: confirmMock,
      showToast: showToastMock,
      reload: reloadMock,
      clearSelection: clearSelectionMock,
    })

    await batch.runBatchProcess([], {
      title: '批量处理',
      buildContent: (count) => `处理 ${count} 个文件`,
      processor: async () => true,
    })

    expect(confirmMock).not.toHaveBeenCalled()
    expect(showToastMock).not.toHaveBeenCalled()
    expect(reloadMock).not.toHaveBeenCalled()
    expect(clearSelectionMock).not.toHaveBeenCalled()
    expect(batch.batchProcessing.value).toBe(false)
    expect(batch.batchProgress.value).toBe('')
    expect(batch.fileStatus.value).toEqual({})
  })

  test('stops when confirmation is cancelled', async () => {
    confirmMock.mockImplementation(async () => false)
    const batch = useInboxBatchActions({
      confirm: confirmMock,
      showToast: showToastMock,
      reload: reloadMock,
      clearSelection: clearSelectionMock,
    })

    const processor = mock(async () => true)

    await batch.runBatchProcess(baseFiles.slice(0, 1), {
      title: '批量处理',
      buildContent: (count) => `处理 ${count} 个文件`,
      processor,
    })

    expect(confirmMock).toHaveBeenCalledWith({
      title: '批量处理',
      content: '处理 1 个文件',
      confirmBtn: '开始',
      cancelBtn: '取消',
    })
    expect(processor).not.toHaveBeenCalled()
    expect(showToastMock).not.toHaveBeenCalled()
    expect(reloadMock).not.toHaveBeenCalled()
    expect(clearSelectionMock).not.toHaveBeenCalled()
    expect(batch.batchProcessing.value).toBe(false)
    expect(batch.fileStatus.value).toEqual({})
  })

  test('processes files sequentially, tracks progress, handles outcomes, and performs cleanup', async () => {
    const batch = useInboxBatchActions({
      confirm: confirmMock,
      showToast: showToastMock,
      reload: reloadMock,
      clearSelection: clearSelectionMock,
    })

    const first = deferred<boolean>()
    const second = deferred<boolean>()
    const third = deferred<void>()
    const callOrder: string[] = []
    const progressSnapshots: string[] = []
    const statusSnapshots: Array<Record<string, 'processing' | 'success' | 'failed'>> = []

    const runPromise = batch.runBatchProcess(baseFiles, {
      title: '批量入库',
      buildContent: (count) => `确认处理 ${count} 个文件？`,
      processor: async (file, helpers) => {
        callOrder.push(file.path)
        helpers.setProgress('处理中')
        progressSnapshots.push(batch.batchProgress.value)
        statusSnapshots.push({ ...batch.fileStatus.value })

        if (file.path === baseFiles[0]?.path) return first.promise
        if (file.path === baseFiles[1]?.path) return second.promise
        await third.promise
        throw new Error('boom')
      },
    })

    await flushAsyncWork()

    expect(batch.batchProcessing.value).toBe(true)
    expect(batch.fileStatus.value).toEqual({
      [baseFiles[0]!.path]: 'processing',
    })
    expect(batch.batchProgress.value).toBe('处理中 1/3...')
    expect(callOrder).toEqual([baseFiles[0]!.path])

    first.resolve(true)
    await flushAsyncWork()

    expect(batch.fileStatus.value[baseFiles[0]!.path]).toBe('success')
    expect(batch.fileStatus.value[baseFiles[1]!.path]).toBe('processing')
    expect(batch.batchProgress.value).toBe('处理中 2/3...')
    expect(callOrder).toEqual([baseFiles[0]!.path, baseFiles[1]!.path])

    second.resolve(false)
    await flushAsyncWork()

    expect(batch.fileStatus.value[baseFiles[1]!.path]).toBe('failed')
    expect(batch.fileStatus.value[baseFiles[2]!.path]).toBe('processing')
    expect(batch.batchProgress.value).toBe('处理中 3/3...')
    expect(callOrder).toEqual([baseFiles[0]!.path, baseFiles[1]!.path, baseFiles[2]!.path])

    third.resolve()
    await runPromise

    expect(progressSnapshots).toEqual([
      '处理中 1/3...',
      '处理中 2/3...',
      '处理中 3/3...',
    ])
    expect(statusSnapshots).toEqual([
      { [baseFiles[0]!.path]: 'processing' },
      {
        [baseFiles[0]!.path]: 'success',
        [baseFiles[1]!.path]: 'processing',
      },
      {
        [baseFiles[0]!.path]: 'success',
        [baseFiles[1]!.path]: 'failed',
        [baseFiles[2]!.path]: 'processing',
      },
    ])
    expect(showToastMock).toHaveBeenCalledWith('完成：1 成功，2 失败')
    expect(reloadMock).toHaveBeenCalledTimes(1)
    expect(clearSelectionMock).toHaveBeenCalledTimes(1)
    expect(batch.batchProcessing.value).toBe(false)
    expect(batch.batchProgress.value).toBe('')
    expect(batch.fileStatus.value).toEqual({})
  })
})
