import type { MediaFile } from '@media-scraper/shared'
import { ref } from 'wevu'

export type BatchProcessor = (
  file: MediaFile,
  helpers: { index: number, total: number, setProgress: (prefix: string) => void },
) => Promise<boolean>

export function useInboxBatchActions(options: {
  confirm: (params: { title: string, content: string, confirmBtn?: string, cancelBtn?: string }) => Promise<boolean>
  showToast: (message: string, theme?: 'success' | 'warning' | 'error') => void
  reload: () => Promise<void>
  clearSelection: () => void
}) {
  const batchProcessing = ref(false)
  const batchProgress = ref('')
  const fileStatus = ref<Record<string, 'processing' | 'success' | 'failed'>>({})

  async function runBatchProcess(
    selectedFiles: MediaFile[],
    config: {
      title: string
      buildContent: (count: number) => string
      processor: BatchProcessor
    },
  ) {
    if (!selectedFiles.length) return

    const confirmed = await options.confirm({
      title: config.title,
      content: config.buildContent(selectedFiles.length),
      confirmBtn: '开始',
      cancelBtn: '取消',
    })
    if (!confirmed) return

    batchProcessing.value = true
    fileStatus.value = {}

    let successCount = 0
    let failCount = 0

    try {
      for (let index = 0; index < selectedFiles.length; index++) {
        const file = selectedFiles[index]
        fileStatus.value[file.path] = 'processing'

        const setProgress = (prefix: string) => {
          batchProgress.value = `${prefix} ${index + 1}/${selectedFiles.length}...`
        }

        try {
          const success = await config.processor(file, { index, total: selectedFiles.length, setProgress })
          fileStatus.value[file.path] = success ? 'success' : 'failed'
          if (success) successCount++
          else failCount++
        }
        catch {
          failCount++
          fileStatus.value[file.path] = 'failed'
        }
      }
    }
    finally {
      batchProcessing.value = false
      batchProgress.value = ''
      fileStatus.value = {}
      options.clearSelection()
    }

    options.showToast(`完成：${successCount} 成功，${failCount} 失败`)
    await options.reload()
  }

  return {
    batchProcessing,
    batchProgress,
    fileStatus,
    runBatchProcess,
  }
}
