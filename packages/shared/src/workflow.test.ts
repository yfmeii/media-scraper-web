import { describe, expect, test } from 'bun:test';
import type { PathRecognizeResult } from './index';
import {
  applyAiRecognizeState,
  buildAiRecognizeMessage,
  buildInboxBatchSummaryMessage,
  buildPreviewItemFromSelection,
  buildRecognizeFallbackCandidate,
  buildRecognizeProcessSelection,
  createInboxPreviewState,
  createEmptyPreviewPlan,
  extractPreviewTargetPath,
  getPreferredRecognizeCandidate,
  getInboxRecognizeInput,
  getInboxSearchKeyword,
  inferCandidateMediaType,
  inferMediaTypeFromParsed,
  mapMatchResultToSelection,
  resolveRecognizeCandidates,
} from './index';
import { makeEpisode } from './test-helpers';

describe('共享工作流辅助函数', () => {
  test('inferMediaTypeFromParsed 根据季集信息判断类型', () => {
    expect(inferMediaTypeFromParsed({ title: 'Show', season: 1 })).toBe('tv');
    expect(inferMediaTypeFromParsed({ title: 'Movie' })).toBe('movie');
  });

  test('inferCandidateMediaType 在缺少 mediaType 时用日期推断', () => {
    expect(inferCandidateMediaType({ firstAirDate: '2024-01-01' })).toBe('tv');
    expect(inferCandidateMediaType({ releaseDate: '2024-01-01' })).toBe('movie');
  });

  test('getInboxSearchKeyword 和 getInboxRecognizeInput 生成统一输入', () => {
    expect(getInboxSearchKeyword({ name: 'Movie.Name.2024.mkv', parsed: { title: '' } as any })).toBe('Movie.Name.2024');
    expect(getInboxSearchKeyword({ name: 'Movie.Name.2024.mkv', parsed: { title: 'Resolved Title' } as any })).toBe('Resolved Title');
    expect(getInboxRecognizeInput({ path: '/inbox/movie.mkv', relativePath: 'movie.mkv' } as any)).toBe('movie.mkv');
  });

  test('resolveRecognizeCandidates 会把偏好候选放到首位', () => {
    const result: PathRecognizeResult = {
      path: 'foo',
      title: 'Test Show',
      media_type: 'tv',
      year: 2024,
      season: 1,
      episode: 2,
      imdb_id: null,
      tmdb_id: 2,
      tmdb_name: 'Test Show',
      preferred_tmdb_id: 2,
      confidence: 0.9,
      reason: 'match',
    };
    const resolved = resolveRecognizeCandidates(result, {
      backendCandidates: [{ id: 1, name: 'Other Show' }],
      imdbResults: [{ id: 2, name: 'Test Show', mediaType: 'tv' }],
    });

    expect(resolved.preferredId).toBe(2);
    expect(resolved.candidates[0]?.id).toBe(2);
    expect(resolved.selectedCandidate?.id).toBe(2);
  });

  test('resolveRecognizeCandidates 会为缺失的偏好候选补回退项', () => {
    const result: PathRecognizeResult = {
      path: 'foo',
      title: 'Missing Candidate',
      media_type: 'movie',
      year: 2023,
      season: null,
      episode: null,
      imdb_id: null,
      tmdb_id: 9,
      tmdb_name: 'Missing Candidate',
      confidence: 0.82,
      reason: 'fallback',
    };

    const resolved = resolveRecognizeCandidates(result, {
      backendCandidates: [{ id: 1, title: 'Other' }],
      preferredId: 9,
    });

    expect(resolved.candidates[0]?.id).toBe(9);
    expect(resolved.selectedCandidate?.title).toBe('Missing Candidate');
  });

  test('mapMatchResultToSelection 映射匹配结果到统一 SearchResult', () => {
    const mapped = mapMatchResultToSelection({
      matched: true,
      result: {
        id: 7,
        name: 'Matched Show',
        mediaType: 'tv',
        date: '2024-01-01',
        score: 0.91,
      },
      candidates: [{
        id: 7,
        name: 'Matched Show',
        mediaType: 'tv',
        date: '2024-01-01',
      }],
    });

    expect(mapped.selectedCandidate?.id).toBe(7);
    expect(mapped.matchScore).toBe(0.91);
    expect(mapped.candidates[0]?.firstAirDate).toBe('2024-01-01');
  });

  test('buildPreviewItemFromSelection 为剧集保留季集信息', () => {
    const file = makeEpisode(3, 2);
    const preview = buildPreviewItemFromSelection({
      file,
      candidate: { id: 9, name: 'Preview Show', mediaType: 'tv' },
      season: 2,
      episode: 3,
    });

    expect(preview.kind).toBe('tv');
    expect(preview.episodes?.[0]?.episode).toBe(3);
  });

  test('extractPreviewTargetPath 优先返回当前源文件的目标路径', () => {
    const path = extractPreviewTargetPath({
      actions: [
        { type: 'create-dir', destination: '/tv/Show', willOverwrite: false },
        { type: 'move', source: '/inbox/a.mkv', destination: '/tv/Show/a.mkv', willOverwrite: false },
      ],
      impactSummary: createEmptyPreviewPlan().impactSummary,
    }, '/inbox/a.mkv');

    expect(path).toBe('/tv/Show/a.mkv');
  });

  test('buildRecognizeFallbackCandidate 和 buildRecognizeProcessSelection 生成兜底流程数据', () => {
    const result: PathRecognizeResult = {
      path: 'foo',
      title: 'Fallback Movie',
      media_type: 'movie',
      year: 2021,
      season: null,
      episode: null,
      imdb_id: null,
      tmdb_id: 12,
      tmdb_name: 'Fallback Movie',
      confidence: 0.7,
      reason: 'fallback',
    };

    expect(buildRecognizeFallbackCandidate(result)?.id).toBe(12);
    const selection = buildRecognizeProcessSelection({
      file: { name: 'Fallback.Movie.mkv', parsed: { title: 'Fallback Movie' } },
      result,
    });
    expect(selection.tmdbId).toBe(12);
    expect(selection.mediaType).toBe('movie');
  });

  test('getPreferredRecognizeCandidate 和 buildRecognizeProcessSelection 支持多候选 AI 结果', () => {
    const result: PathRecognizeResult = {
      path: 'foo',
      title: 'Andor',
      media_type: 'tv',
      year: 2022,
      season: 1,
      episode: 1,
      imdb_id: null,
      tmdb_id: 100,
      tmdb_name: 'Andor',
      preferred_tmdb_id: 200,
      recognize_candidates: [
        {
          title: 'Andor Backup',
          media_type: 'movie',
          year: 2024,
          season: null,
          episode: null,
          imdb_id: null,
          tmdb_id: 100,
          tmdb_name: 'Andor Backup',
          confidence: 0.3,
          reason: 'weak',
        },
        {
          title: 'Andor',
          media_type: 'tv',
          year: 2022,
          season: 3,
          episode: 7,
          imdb_id: null,
          tmdb_id: 200,
          tmdb_name: 'Andor',
          preferred_tmdb_id: 200,
          confidence: 0.9,
          reason: 'strong',
        },
      ],
      confidence: 0.9,
      reason: 'multi',
    };

    expect(getPreferredRecognizeCandidate(result)?.tmdb_id).toBe(200);
    const selection = buildRecognizeProcessSelection({
      file: { name: 'Andor.S03E07.mkv', parsed: { title: 'Andor', season: 1, episode: 1 } },
      result,
    });
    expect(selection.tmdbId).toBe(200);
    expect(selection.mediaType).toBe('tv');
    expect(selection.season).toBe(3);
    expect(selection.episode).toBe(7);
  });

  test('buildAiRecognizeMessage 和 applyAiRecognizeState 生成提示与应用状态', () => {
    expect(buildAiRecognizeMessage({ media_type: 'tv', confidence: 0.91 } as any)).toContain('AI 识别为剧集');
    expect(buildAiRecognizeMessage({ media_type: 'movie', confidence: 0.62 } as any)).toContain('AI 置信度较低');

    expect(applyAiRecognizeState({
      resolved: {
        aiRecognizeResult: null,
        matchCandidates: [{ id: 1, name: 'Show' }],
        selectedCandidate: { id: 1, name: 'Show' },
        operationMessage: 'ok',
      },
      currentSeason: 2,
      currentEpisode: 8,
    })).toEqual({
      aiRecognizeResult: null,
      matchCandidates: [{ id: 1, name: 'Show' }],
      selectedCandidate: { id: 1, name: 'Show' },
      editSeason: 2,
      editEpisode: 8,
      operationMessage: 'ok',
    });
  });

  test('buildInboxBatchSummaryMessage 和 createInboxPreviewState 生成共享展示数据', () => {
    expect(buildInboxBatchSummaryMessage({ successCount: 2, tvCount: 1, movieCount: 1, failCount: 3 })).toBe(
      '完成: 2 成功 (1 剧集, 1 电影), 3 失败',
    );

    const preview = createInboxPreviewState({
      actions: [{ type: 'create-dir', destination: '/tv/Show', willOverwrite: false }],
      impactSummary: createEmptyPreviewPlan().impactSummary,
    });
    expect(preview.previewActions).toHaveLength(1);
    expect(preview.previewSummary).toEqual(createEmptyPreviewPlan().impactSummary);
  });

  test('buildPreviewItemFromSelection 为电影保留 movie 类型且不附带剧集信息', () => {
    const preview = buildPreviewItemFromSelection({
      file: { path: '/inbox/Movie.mkv', name: 'Movie.mkv', parsed: { title: 'Movie' } },
      candidate: { id: 5, title: 'Movie', mediaType: 'movie' },
    });

    expect(preview.kind).toBe('movie');
    expect(preview.episodes).toBeUndefined();
  });
});
