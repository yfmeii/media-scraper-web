import { describe, expect, test } from 'bun:test';
import { handleItemClick, toggleAllSelection } from './selection';

describe('selection', () => {
  const items = ['a', 'b', 'c', 'd', 'e'].map(path => ({ path }));
  const getPath = (item: { path: string }) => item.path;

  test('✅ 单击选择仅保留当前项', () => {
    const selected = new Set(['a', 'b']);
    const event = { shiftKey: false, ctrlKey: false, metaKey: false } as unknown as MouseEvent;
    const next = handleItemClick('c', event, selected, items, getPath);
    expect(Array.from(next)).toEqual(['c']);
  });

  test('🔀 Ctrl/Meta 点击切换选中', () => {
    let selected = new Set(['a']);
    const ctrlEvent = { shiftKey: false, ctrlKey: true, metaKey: false } as unknown as MouseEvent;
    selected = handleItemClick('b', ctrlEvent, selected, items, getPath);
    expect(selected.has('a')).toBe(true);
    expect(selected.has('b')).toBe(true);

    selected = handleItemClick('a', ctrlEvent, selected, items, getPath);
    expect(selected.has('a')).toBe(false);
    expect(selected.has('b')).toBe(true);
  });

  test('📏 Shift 点击进行范围选择', () => {
    const selected = new Set(['b']);
    const shiftEvent = { shiftKey: true, ctrlKey: false, metaKey: false } as unknown as MouseEvent;
    const next = handleItemClick('d', shiftEvent, selected, items, getPath);
    expect(next.has('b')).toBe(true);
    expect(next.has('c')).toBe(true);
    expect(next.has('d')).toBe(true);
  });

  test('🧹 全选与清空切换', () => {
    let selected = new Set<string>();
    selected = toggleAllSelection(selected, items, getPath);
    expect(selected.size).toBe(items.length);

    selected = toggleAllSelection(selected, items, getPath);
    expect(selected.size).toBe(0);
  });
});
