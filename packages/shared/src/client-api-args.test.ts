import { describe, expect, test } from 'bun:test';
import { createClientApi } from './index';

describe('共享客户端 API 参数解析', () => {
  test('searchTMDB 在省略类型时默认 multi', async () => {
    const calls: string[] = [];
    const api = createClientApi({
      async get<T = unknown>(path: string) {
        calls.push(path);
        return { success: true, data: [] as unknown as T };
      },
      async post<T = unknown>() {
        return { success: true, data: {} as T };
      },
    });

    await api.searchTMDB('Arrival', 2016);

    expect(calls[0]).toBe('/scrape/search/multi?q=Arrival&year=2016');
  });

  test('autoMatch 支持省略 kind 并保留默认语言', async () => {
    let payload: Record<string, unknown> | undefined;
    const api = createClientApi({
      async get<T = unknown>() {
        return { success: true, data: [] as unknown as T };
      },
      async post<T = unknown>(_path: string, body?: Record<string, unknown>) {
        payload = body;
        return { success: true, data: { matched: false, candidates: [] } as unknown as T };
      },
    });

    await api.autoMatch('/inbox/Arrival.mkv', 'Arrival', 2016);

    expect(payload).toEqual({
      path: '/inbox/Arrival.mkv',
      kind: undefined,
      title: 'Arrival',
      year: 2016,
      language: 'zh-CN',
    });
  });
});
