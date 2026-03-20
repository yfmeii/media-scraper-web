import { describe, expect, test } from 'bun:test';
import {
  buildCollectionResponse,
  buildDetailResponse,
  buildInboxDirectoryResponse,
  buildStatsResponse,
  buildStatusGroups,
} from './media-response';

describe('media response builders', () => {
  test('builds grouped and collection responses', () => {
    const items = [{ groupStatus: 'scraped' }, { groupStatus: 'unscraped' }, { groupStatus: 'supplement' }];
    expect(buildStatusGroups(items)).toEqual({ scraped: 1, unscraped: 1, supplement: 1 });
    expect(buildCollectionResponse([1, 2, 3])).toEqual({ success: true, data: [1, 2, 3], total: 3, groups: undefined });
    expect(buildDetailResponse({ path: '/tv/a' })).toEqual({ success: true, data: { path: '/tv/a' } });
  });

  test('builds inbox directory response and stats payload', () => {
    expect(buildInboxDirectoryResponse([{ files: [1, 2] }, { files: [3] }])).toEqual({
      success: true,
      data: [{ files: [1, 2] }, { files: [3] }],
      total: 3,
      directories: 2,
    });

    expect(buildStatsResponse(
      [{ isProcessed: true, episodeCount: 2, seasons: [{ episodes: [1, 2] }] }],
      [{ isProcessed: false }, { isProcessed: true }],
      [1, 2, 3],
    )).toEqual({
      success: true,
      data: {
        tvShows: 1,
        tvEpisodes: 2,
        tvProcessed: 1,
        movies: 2,
        moviesProcessed: 1,
        inbox: 3,
      },
    });
  });
});
