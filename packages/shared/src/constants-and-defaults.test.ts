import { describe, expect, test } from 'bun:test';
import {
  CLIENT_API_ENDPOINTS,
  DEFAULT_LANGUAGE,
  NFO_EXTS,
  SUB_EXTS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  VIDEO_EXTS,
  createEmptyMatchResult,
  createEmptyPreviewPlan,
  createEmptyTaskStats,
} from './index';

describe('常量', () => {
  test('DEFAULT_LANGUAGE 为 zh-CN', () => {
    expect(DEFAULT_LANGUAGE).toBe('zh-CN');
  });

  test('VIDEO_EXTS 包含常见视频扩展名', () => {
    expect(VIDEO_EXTS).toContain('.mkv');
    expect(VIDEO_EXTS).toContain('.mp4');
    expect(VIDEO_EXTS).toContain('.avi');
    expect(VIDEO_EXTS).toContain('.mov');
    expect(VIDEO_EXTS).toContain('.m4v');
    expect(VIDEO_EXTS.length).toBe(5);
  });

  test('SUB_EXTS 包含常见字幕扩展名', () => {
    expect(SUB_EXTS).toContain('.srt');
    expect(SUB_EXTS).toContain('.ass');
    expect(SUB_EXTS).toContain('.ssa');
    expect(SUB_EXTS).toContain('.sub');
    expect(SUB_EXTS.length).toBe(4);
  });

  test('NFO_EXTS 包含 .nfo', () => {
    expect(NFO_EXTS).toContain('.nfo');
    expect(NFO_EXTS.length).toBe(1);
  });

  test('TASK_STATUS_LABELS 包含所有状态', () => {
    expect(TASK_STATUS_LABELS.pending).toBe('等待');
    expect(TASK_STATUS_LABELS.running).toBe('进行中');
    expect(TASK_STATUS_LABELS.success).toBe('完成');
    expect(TASK_STATUS_LABELS.failed).toBe('失败');
    expect(TASK_STATUS_LABELS.cancelled).toBe('已取消');
  });

  test('TASK_TYPE_LABELS 包含所有类型', () => {
    expect(TASK_TYPE_LABELS.scrape).toBe('刮削');
    expect(TASK_TYPE_LABELS.process).toBe('处理');
    expect(TASK_TYPE_LABELS.refresh).toBe('刷新');
    expect(TASK_TYPE_LABELS.supplement).toBe('补刮');
    expect(TASK_TYPE_LABELS['fix-assets']).toBe('修复资产');
  });

  test('CLIENT_API_ENDPOINTS 包含核心接口', () => {
    expect(CLIENT_API_ENDPOINTS.fetchStats).toBe('/media/stats');
    expect(CLIENT_API_ENDPOINTS.fetchTVShows).toBe('/media/tv?include=assets&group=status&detail=summary');
    expect(CLIENT_API_ENDPOINTS.fetchTVShowDetail).toBe('/media/tv/detail');
    expect(CLIENT_API_ENDPOINTS.fetchMovies).toBe('/media/movies?include=assets&detail=summary');
    expect(CLIENT_API_ENDPOINTS.fetchMovieDetail).toBe('/media/movies/detail');
    expect(CLIENT_API_ENDPOINTS.autoMatch).toBe('/scrape/match');
    expect(CLIENT_API_ENDPOINTS.previewPlan).toBe('/scrape/preview');
  });
});

describe('API 默认对象工厂', () => {
  test('createEmptyTaskStats 返回默认统计结构', () => {
    expect(createEmptyTaskStats()).toEqual({
      total: 0,
      pending: 0,
      running: 0,
      success: 0,
      failed: 0,
    });
  });

  test('createEmptyMatchResult 返回默认匹配结构', () => {
    expect(createEmptyMatchResult()).toEqual({
      matched: false,
      candidates: [],
    });
  });

  test('createEmptyPreviewPlan 返回默认预览结构', () => {
    expect(createEmptyPreviewPlan()).toEqual({
      actions: [],
      impactSummary: {
        filesMoving: 0,
        nfoCreating: 0,
        nfoOverwriting: 0,
        postersDownloading: 0,
        directoriesCreating: [],
      },
    });
  });
});
