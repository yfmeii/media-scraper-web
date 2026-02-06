import Dialog from 'tdesign-miniprogram/dialog/index'
import { getCurrentInstance } from 'wevu'

export interface DialogOptions {
  selector?: string
}

export interface AlertOptions {
  title: string
  content: string
  confirmBtn?: string
}

export interface ConfirmOptions {
  title: string
  content: string
  confirmBtn?: string
  cancelBtn?: string
}

export function useDialog(options: DialogOptions = {}) {
  const mpContext = getCurrentInstance()
  const selector = options.selector ?? '#t-dialog'

  function alert(payload: AlertOptions) {
    if (!mpContext) {
      return
    }
    Dialog.alert({
      selector,
      context: mpContext as any,
      ...payload,
    })
  }

  /** 使用原生 wx.showModal 实现确认对话框，返回 Promise<boolean> */
  function confirm(payload: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      wx.showModal({
        title: payload.title,
        content: payload.content,
        confirmText: payload.confirmBtn || '确认',
        cancelText: payload.cancelBtn || '取消',
        success: (res) => {
          resolve(!!res.confirm)
        },
        fail: () => {
          resolve(false)
        },
      })
    })
  }

  return {
    alert,
    confirm,
  }
}
