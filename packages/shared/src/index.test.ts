import { describe, expect, test } from 'bun:test';
import {
  // Types
  type MediaKind,
  type MediaFile,
  type ShowInfo,
  type SeasonMissingInfo,

  // Constants
  DEFAULT_LANGUAGE,
  VIDEO_EXTS,
  SUB_EXTS,
  NFO_EXTS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  CLIENT_API_ENDPOINTS,

  // Formatting utilities
  formatFileSize,
  formatDate,
  formatSeason,
  formatEpisode,
  formatSeasonEpisode,
  formatRating,
  formatRuntime,
  getMediaKindLabel,
  normalizeMediaKind,

  // Missing episodes
  getSeasonMissingEpisodes,
  getShowMissingEpisodes,
  formatMissingSxEx,
  createEmptyTaskStats,
  createEmptyMatchResult,
  createEmptyPreviewPlan,
} from './index';

// ── Helpers ──

function makeEpisode(episode: number, season = 1): MediaFile {
  return {
    path: `/tv/show/Season ${season}/S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}.mkv`,
    name: `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}.mkv`,
    relativePath: `Season ${season}/S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}.mkv`,
    size: 1024 * 1024 * 500,
    kind: 'tv',
    parsed: { title: 'Show', season, episode },
    hasNfo: false,
    isProcessed: false,
  };
}

function makeShow(seasons: { season: number; episodes: number[] }[]): ShowInfo {
  return {
    path: '/tv/show',
    name: 'Test Show',
    seasons: seasons.map(s => ({
      season: s.season,
      episodes: s.episodes.map(ep => makeEpisode(ep, s.season)),
    })),
    hasNfo: true,
    isProcessed: true,
  };
}

// ── Constants ──

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
    expect(CLIENT_API_ENDPOINTS.fetchTVShows).toBe('/media/tv?include=assets&group=status');
    expect(CLIENT_API_ENDPOINTS.fetchMovies).toBe('/media/movies?include=assets');
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

// ── Formatting Utilities ──

describe('formatFileSize', () => {
  test('undefined 返回 "?"', () => {
    expect(formatFileSize(undefined)).toBe('?');
  });

  test('0 返回 "0 B"', () => {
    expect(formatFileSize(0)).toBe('0 B');
  });

  test('小于 1KB 显示 B（无小数）', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1)).toBe('1 B');
    expect(formatFileSize(999)).toBe('999 B');
  });

  test('KB 级别显示一位小数', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(10240)).toBe('10.0 KB');
  });

  test('MB 级别显示一位小数', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
    expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.5 MB');
  });

  test('GB 级别显示一位小数', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    expect(formatFileSize(1024 * 1024 * 1024 * 4.7)).toBe('4.7 GB');
  });

  test('TB 级别显示一位小数', () => {
    expect(formatFileSize(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB');
  });
});

describe('formatDate', () => {
  test('undefined 返回 "--"', () => {
    expect(formatDate(undefined)).toBe('--');
  });

  test('空字符串返回 "--"', () => {
    expect(formatDate('')).toBe('--');
  });

  test('ISO 日期字符串格式化正确', () => {
    expect(formatDate('2024-06-15T12:00:00Z')).toBe('2024-06-15');
  });

  test('纯日期字符串格式化正确', () => {
    expect(formatDate('2020-01-01')).toBe('2020-01-01');
  });

  test('时间戳格式化正确', () => {
    const ts = new Date(2023, 11, 25).getTime(); // Dec 25, 2023
    expect(formatDate(ts)).toBe('2023-12-25');
  });

  test('Date 对象格式化正确', () => {
    expect(formatDate(new Date(2025, 0, 1))).toBe('2025-01-01');
  });

  test('无效日期返回 "--"', () => {
    expect(formatDate('not-a-date')).toBe('--');
  });

  test('月/日补零', () => {
    expect(formatDate('2020-03-05')).toBe('2020-03-05');
  });
});

describe('formatSeason', () => {
  test('单位数季补零', () => {
    expect(formatSeason(1)).toBe('Season 01');
    expect(formatSeason(9)).toBe('Season 09');
  });

  test('双位数季不补零', () => {
    expect(formatSeason(10)).toBe('Season 10');
    expect(formatSeason(25)).toBe('Season 25');
  });
});

describe('formatEpisode', () => {
  test('单位数集补零', () => {
    expect(formatEpisode(1)).toBe('E01');
    expect(formatEpisode(9)).toBe('E09');
  });

  test('双位数集不补零', () => {
    expect(formatEpisode(10)).toBe('E10');
    expect(formatEpisode(99)).toBe('E99');
  });

  test('三位数集正常显示', () => {
    expect(formatEpisode(100)).toBe('E100');
  });
});

describe('formatSeasonEpisode', () => {
  test('标准格式 SxxExx', () => {
    expect(formatSeasonEpisode(1, 1)).toBe('S01E01');
    expect(formatSeasonEpisode(2, 15)).toBe('S02E15');
    expect(formatSeasonEpisode(10, 5)).toBe('S10E05');
  });
});

describe('formatRating', () => {
  test('undefined 返回 "--"', () => {
    expect(formatRating(undefined)).toBe('--');
  });

  test('0 返回 "--"（falsy）', () => {
    expect(formatRating(0)).toBe('--');
  });

  test('正常评分保留一位小数', () => {
    expect(formatRating(8.5)).toBe('8.5');
    expect(formatRating(7)).toBe('7.0');
    expect(formatRating(9.99)).toBe('10.0');
    expect(formatRating(6.12)).toBe('6.1');
  });
});

describe('formatRuntime', () => {
  test('undefined 返回 "--"', () => {
    expect(formatRuntime(undefined)).toBe('--');
  });

  test('0 返回 "--"（falsy）', () => {
    expect(formatRuntime(0)).toBe('--');
  });

  test('不足一小时只显示分钟', () => {
    expect(formatRuntime(45)).toBe('45m');
    expect(formatRuntime(1)).toBe('1m');
    expect(formatRuntime(59)).toBe('59m');
  });

  test('超过一小时显示小时和分钟', () => {
    expect(formatRuntime(60)).toBe('1h 0m');
    expect(formatRuntime(90)).toBe('1h 30m');
    expect(formatRuntime(120)).toBe('2h 0m');
    expect(formatRuntime(148)).toBe('2h 28m');
  });
});

describe('getMediaKindLabel', () => {
  test('tv 返回 "剧集"', () => {
    expect(getMediaKindLabel('tv')).toBe('剧集');
  });

  test('movie 返回 "电影"', () => {
    expect(getMediaKindLabel('movie')).toBe('电影');
  });

  test('unknown 返回 "未知"', () => {
    expect(getMediaKindLabel('unknown')).toBe('未知');
  });

  test('其他任意值返回 "未知"', () => {
    expect(getMediaKindLabel('other')).toBe('未知');
    expect(getMediaKindLabel('')).toBe('未知');
  });
});

describe('normalizeMediaKind', () => {
  test('tv 保持 tv', () => {
    expect(normalizeMediaKind('tv')).toBe('tv');
  });

  test('movie 保持 movie', () => {
    expect(normalizeMediaKind('movie')).toBe('movie');
  });

  test('unknown 回落为 movie', () => {
    expect(normalizeMediaKind('unknown')).toBe('movie');
  });

  test('其他任意值回落为 movie', () => {
    expect(normalizeMediaKind('other')).toBe('movie');
    expect(normalizeMediaKind('')).toBe('movie');
  });
});

// ── Missing Episodes Detection ──

describe('getSeasonMissingEpisodes', () => {
  test('空数组返回空', () => {
    expect(getSeasonMissingEpisodes([])).toEqual([]);
  });

  test('单集返回空', () => {
    expect(getSeasonMissingEpisodes([makeEpisode(1)])).toEqual([]);
  });

  test('连续集数返回空', () => {
    const episodes = [makeEpisode(1), makeEpisode(2), makeEpisode(3)];
    expect(getSeasonMissingEpisodes(episodes)).toEqual([]);
  });

  test('检测中间缺集', () => {
    const episodes = [makeEpisode(1), makeEpisode(3), makeEpisode(5)];
    expect(getSeasonMissingEpisodes(episodes)).toEqual([2, 4]);
  });

  test('检测多处缺集', () => {
    const episodes = [makeEpisode(1), makeEpisode(5), makeEpisode(10)];
    expect(getSeasonMissingEpisodes(episodes)).toEqual([2, 3, 4, 6, 7, 8, 9]);
  });

  test('乱序集数也能正确检测', () => {
    const episodes = [makeEpisode(5), makeEpisode(1), makeEpisode(3)];
    expect(getSeasonMissingEpisodes(episodes)).toEqual([2, 4]);
  });

  test('忽略无效集号（null/0/negative）', () => {
    const ep1 = makeEpisode(1);
    const epBad = makeEpisode(0); // episode=0 should be filtered
    const ep3 = makeEpisode(3);
    expect(getSeasonMissingEpisodes([ep1, epBad, ep3])).toEqual([2]);
  });
});

describe('getShowMissingEpisodes', () => {
  test('无缺集的剧返回空', () => {
    const show = makeShow([
      { season: 1, episodes: [1, 2, 3] },
      { season: 2, episodes: [1, 2] },
    ]);
    expect(getShowMissingEpisodes(show)).toEqual([]);
  });

  test('多季缺集检测', () => {
    const show = makeShow([
      { season: 1, episodes: [1, 3] },     // missing E02
      { season: 2, episodes: [1, 2, 3] },  // complete
      { season: 3, episodes: [1, 4] },     // missing E02, E03
    ]);
    const result = getShowMissingEpisodes(show);
    expect(result).toEqual([
      { season: 1, missing: [2] },
      { season: 3, missing: [2, 3] },
    ]);
  });

  test('只有一季的剧', () => {
    const show = makeShow([
      { season: 1, episodes: [1, 2, 5] },
    ]);
    const result = getShowMissingEpisodes(show);
    expect(result).toEqual([
      { season: 1, missing: [3, 4] },
    ]);
  });

  test('空季被过滤', () => {
    const show = makeShow([
      { season: 1, episodes: [] },
      { season: 2, episodes: [1, 3] },
    ]);
    const result = getShowMissingEpisodes(show);
    expect(result).toEqual([
      { season: 2, missing: [2] },
    ]);
  });
});

describe('formatMissingSxEx', () => {
  test('空列表返回空字符串', () => {
    expect(formatMissingSxEx([])).toBe('');
  });

  test('单季缺集格式化', () => {
    const missing: SeasonMissingInfo[] = [
      { season: 1, missing: [2, 4] },
    ];
    expect(formatMissingSxEx(missing)).toBe('S01E02, S01E04');
  });

  test('多季缺集格式化', () => {
    const missing: SeasonMissingInfo[] = [
      { season: 1, missing: [3] },
      { season: 2, missing: [1, 5] },
    ];
    expect(formatMissingSxEx(missing)).toBe('S01E03, S02E01, S02E05');
  });

  test('季号和集号补零', () => {
    const missing: SeasonMissingInfo[] = [
      { season: 1, missing: [1] },
    ];
    expect(formatMissingSxEx(missing)).toBe('S01E01');
  });

  test('大季号/集号正常显示', () => {
    const missing: SeasonMissingInfo[] = [
      { season: 10, missing: [100] },
    ];
    expect(formatMissingSxEx(missing)).toBe('S10E100');
  });
});
