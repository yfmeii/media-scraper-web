/**
 * 确认对话框状态管理 Store
 * 提供全局的确认对话框状态，避免每个页面重复定义
 */
import { writable } from 'svelte/store';

interface ConfirmDialogState {
  show: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  confirmVariant: 'primary' | 'destructive';
  onConfirm: (() => void) | null;
}

const defaultState: ConfirmDialogState = {
  show: false,
  title: '确认',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  confirmVariant: 'primary',
  onConfirm: null,
};

function createConfirmDialog() {
  const { subscribe, set, update } = writable<ConfirmDialogState>(defaultState);

  return {
    subscribe,
    
    /**
     * 显示确认对话框
     */
    show: (options: {
      title: string;
      message: string;
      onConfirm: () => void;
      confirmText?: string;
      cancelText?: string;
      confirmVariant?: 'primary' | 'destructive';
    }) => {
      set({
        show: true,
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || '确定',
        cancelText: options.cancelText || '取消',
        confirmVariant: options.confirmVariant || 'primary',
        onConfirm: options.onConfirm,
      });
    },
    
    /**
     * 确认操作
     */
    confirm: () => {
      update(state => {
        if (state.onConfirm) {
          state.onConfirm();
        }
        return defaultState;
      });
    },
    
    /**
     * 取消操作
     */
    cancel: () => {
      set(defaultState);
    },
    
    /**
     * 重置状态
     */
    reset: () => {
      set(defaultState);
    },
  };
}

export const confirmDialog = createConfirmDialog();
