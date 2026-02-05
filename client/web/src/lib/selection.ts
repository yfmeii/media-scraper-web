/**
 * 通用选择逻辑工具函数
 * 用于 TV、Movies、Inbox 等页面的多选功能
 */

export interface SelectionState<T> {
  selected: Set<string>;
  getPath: (item: T) => string;
}

/**
 * 处理项目点击选择
 * 支持：普通单选、Ctrl多选、Shift范围选
 */
export function handleItemClick<T>(
  path: string,
  event: MouseEvent,
  selected: Set<string>,
  allItems: T[],
  getPath: (item: T) => string
): Set<string> {
  const newSelected = new Set(selected);
  
  if (event.shiftKey && newSelected.size > 0) {
    // Shift-click: 范围选择
    const paths = allItems.map(getPath);
    const lastSelected = Array.from(newSelected).pop()!;
    const lastIdx = paths.indexOf(lastSelected);
    const currentIdx = paths.indexOf(path);
    const [start, end] = lastIdx < currentIdx ? [lastIdx, currentIdx] : [currentIdx, lastIdx];
    for (let i = start; i <= end; i++) {
      newSelected.add(paths[i]);
    }
  } else if (event.ctrlKey || event.metaKey) {
    // Ctrl-click: 切换单个
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
  } else {
    // 普通点击: 单选
    newSelected.clear();
    newSelected.add(path);
  }
  
  return newSelected;
}

/**
 * 切换全选/取消全选
 */
export function toggleAllSelection<T>(
  selected: Set<string>,
  allItems: T[],
  getPath: (item: T) => string
): Set<string> {
  const newSelected = new Set<string>();
  
  if (selected.size === allItems.length) {
    // 已全选，清空
    return newSelected;
  } else {
    // 全选
    allItems.forEach(item => newSelected.add(getPath(item)));
    return newSelected;
  }
}

/**
 * 创建选择处理器（工厂函数）
 */
export function createSelectionHandler<T>(getPath: (item: T) => string) {
  return {
    handleClick: (
      path: string,
      event: MouseEvent,
      selected: Set<string>,
      allItems: T[]
    ) => handleItemClick(path, event, selected, allItems, getPath),
    
    toggleAll: (
      selected: Set<string>,
      allItems: T[]
    ) => toggleAllSelection(selected, allItems, getPath),
  };
}
