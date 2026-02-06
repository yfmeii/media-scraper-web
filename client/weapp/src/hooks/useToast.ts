export type ToastTheme = 'success' | 'warning' | 'error' | 'default' | 'loading'

export interface ToastOptions {
  duration?: number
  theme?: ToastTheme
}

export function useToast(options: ToastOptions = {}) {
  const duration = options.duration ?? 1200
  const defaultTheme = options.theme ?? 'success'

  function resolveIcon(theme: ToastTheme): WechatMiniprogram.ShowToastOption['icon'] {
    if (theme === 'success') return 'success'
    if (theme === 'loading') return 'loading'
    if (theme === 'error') return 'error'
    return 'none'
  }

  function showToast(message: string, theme: ToastTheme = defaultTheme) {
    const title = (message || '').trim()
    if (!title) return

    wx.showToast({
      title,
      icon: resolveIcon(theme),
      duration,
    })
  }

  return {
    showToast,
  }
}
