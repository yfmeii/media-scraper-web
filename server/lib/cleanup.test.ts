import { beforeAll, describe, expect, test } from 'bun:test';
import { cleanupSourceDir, isProtectedDir, isVideoFile } from './cleanup';
import type { FileSystemOps } from './cleanup';

// ── In-Memory Filesystem Mock ──

/**
 * A lightweight in-memory filesystem mock.
 *
 * Stores directory → filename[] mapping.
 * Tracks all operations (readdir, rmdir) for assertions.
 */
interface MockFs extends FileSystemOps {
  /** Current directory tree state */
  tree: Record<string, string[]>;
  /** Log of operations performed */
  ops: Array<{ type: 'readdir' | 'rmdir'; path: string }>;
  /** Whether the next readdir should throw (simulates inaccessible dir) */
  failNextReaddir: boolean;
}

function createMockFs(tree: Record<string, string[]> = {}): MockFs {
  const mock: MockFs = {
    tree: { ...tree },
    ops: [],
    failNextReaddir: false,

    async readdir(dirPath: string): Promise<string[]> {
      mock.ops.push({ type: 'readdir', path: dirPath });
      if (mock.failNextReaddir) {
        mock.failNextReaddir = false;
        throw new Error('EACCES: permission denied');
      }
      const entries = mock.tree[dirPath];
      if (entries === undefined) {
        throw new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`);
      }
      return [...entries];
    },

    async rmdir(dirPath: string): Promise<void> {
      mock.ops.push({ type: 'rmdir', path: dirPath });
      const entries = mock.tree[dirPath];
      if (entries === undefined) {
        throw new Error(`ENOENT: no such file or directory, rmdir '${dirPath}'`);
      }
      if (entries.length > 0) {
        throw new Error(`ENOTEMPTY: directory not empty, rmdir '${dirPath}'`);
      }
      delete mock.tree[dirPath];
    },
  };

  return mock;
}

// ── Setup env vars so MEDIA_PATHS getters return known values ──

beforeAll(() => {
  process.env.INBOX_PATH = '/mnt/media/Inbox';
  process.env.TV_PATH = '/mnt/media/TV';
  process.env.MOVIES_PATH = '/mnt/media/Movies';
});

// ══════════════════════════════════════════════════════════════
// Helper utilities
// ══════════════════════════════════════════════════════════════

describe('isVideoFile', () => {
  test('识别常见视频扩展名', () => {
    expect(isVideoFile('movie.mkv')).toBe(true);
    expect(isVideoFile('movie.mp4')).toBe(true);
    expect(isVideoFile('movie.avi')).toBe(true);
    expect(isVideoFile('movie.mov')).toBe(true);
    expect(isVideoFile('movie.m4v')).toBe(true);
  });

  test('大写扩展名也能识别', () => {
    expect(isVideoFile('movie.MKV')).toBe(true);
    expect(isVideoFile('movie.MP4')).toBe(true);
  });

  test('非视频文件返回 false', () => {
    expect(isVideoFile('subtitle.srt')).toBe(false);
    expect(isVideoFile('metadata.nfo')).toBe(false);
    expect(isVideoFile('poster.jpg')).toBe(false);
    expect(isVideoFile('readme.txt')).toBe(false);
    expect(isVideoFile('.DS_Store')).toBe(false);
  });

  test('无扩展名返回 false', () => {
    expect(isVideoFile('noext')).toBe(false);
    expect(isVideoFile('')).toBe(false);
  });
});

describe('isProtectedDir', () => {
  test('Inbox 根目录受保护', () => {
    expect(isProtectedDir('/mnt/media/Inbox')).toBe(true);
  });

  test('TV 根目录受保护', () => {
    expect(isProtectedDir('/mnt/media/TV')).toBe(true);
  });

  test('Movies 根目录受保护', () => {
    expect(isProtectedDir('/mnt/media/Movies')).toBe(true);
  });

  test('带尾斜杠的保护目录同样受保护', () => {
    expect(isProtectedDir('/mnt/media/Inbox/')).toBe(true);
    expect(isProtectedDir('/mnt/media/Inbox//')).toBe(true);
  });

  test('子目录不受保护', () => {
    expect(isProtectedDir('/mnt/media/Inbox/subfolder')).toBe(false);
    expect(isProtectedDir('/mnt/media/TV/Show Name')).toBe(false);
    expect(isProtectedDir('/mnt/media/Movies/Movie (2024)')).toBe(false);
  });

  test('其他任意路径不受保护', () => {
    expect(isProtectedDir('/tmp/foo')).toBe(false);
    expect(isProtectedDir('/home/user')).toBe(false);
    expect(isProtectedDir('/')).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════
// Core cleanup logic
// ══════════════════════════════════════════════════════════════

describe('cleanupSourceDir', () => {
  // ── Protected directories ──

  describe('保护目录', () => {
    test('不删除 Inbox 根目录（即使为空）', async () => {
      const fs = createMockFs({ '/mnt/media/Inbox': [] });
      const result = await cleanupSourceDir('/mnt/media/Inbox', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('protected');
      expect(fs.tree['/mnt/media/Inbox']).toBeDefined();
      // Should not even try to readdir
      expect(fs.ops.length).toBe(0);
    });

    test('不删除 TV 根目录', async () => {
      const fs = createMockFs({ '/mnt/media/TV': [] });
      const result = await cleanupSourceDir('/mnt/media/TV', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('protected');
    });

    test('不删除 Movies 根目录', async () => {
      const fs = createMockFs({ '/mnt/media/Movies': [] });
      const result = await cleanupSourceDir('/mnt/media/Movies', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('protected');
    });

    test('带尾斜杠的 Inbox 同样受保护', async () => {
      const fs = createMockFs({ '/mnt/media/Inbox': [] });
      const result = await cleanupSourceDir('/mnt/media/Inbox/', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('protected');
    });
  });

  // ── Empty directories ──

  describe('空目录清理', () => {
    test('空子目录被清理', async () => {
      const fs = createMockFs({ '/mnt/media/Inbox/subfolder': [] });
      const result = await cleanupSourceDir('/mnt/media/Inbox/subfolder', fs);
      expect(result.deleted).toBe(true);
      expect(result.reason).toBe('deleted');
      expect(fs.tree['/mnt/media/Inbox/subfolder']).toBeUndefined();
    });

    test('深层嵌套空目录被清理', async () => {
      const fs = createMockFs({ '/mnt/media/Inbox/a/b/c/d': [] });
      const result = await cleanupSourceDir('/mnt/media/Inbox/a/b/c/d', fs);
      expect(result.deleted).toBe(true);
      expect(result.reason).toBe('deleted');
    });

    test('Movies 下的空子目录被清理', async () => {
      const fs = createMockFs({ '/mnt/media/Movies/Deleted Movie (2020)': [] });
      const result = await cleanupSourceDir('/mnt/media/Movies/Deleted Movie (2020)', fs);
      expect(result.deleted).toBe(true);
      expect(result.reason).toBe('deleted');
    });
  });

  // ── Directories with video files ──

  describe('含视频文件的目录', () => {
    test('有 .mkv 文件不删除', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/batch': ['other-movie.mkv'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/batch', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('has-video');
    });

    test('有 .mp4 文件不删除', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/batch': ['video.mp4'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/batch', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('has-video');
    });

    test('有 .avi 文件不删除', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/batch': ['old-movie.avi'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/batch', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('has-video');
    });

    test('大写视频扩展名同样保护', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/batch': ['MOVIE.MKV'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/batch', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('has-video');
    });

    test('多个视频文件不删除', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/batch': ['movie1.mkv', 'movie2.mp4', 'movie3.avi'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/batch', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('has-video');
    });

    test('视频与非视频混合不删除', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/batch': ['movie.mkv', 'subtitle.srt', 'poster.jpg'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/batch', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('has-video');
    });
  });

  // ── Directories with non-video files only ──

  describe('仅含非视频文件的目录', () => {
    test('只有字幕文件不删除', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/sub': ['episode.srt', 'episode.ass'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/sub', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('not-empty');
    });

    test('只有 NFO 文件不删除', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/sub': ['tvshow.nfo'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/sub', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('not-empty');
    });

    test('只有图片文件不删除', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/sub': ['poster.jpg', 'fanart.jpg'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/sub', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('not-empty');
    });

    test('只有隐藏文件 (.DS_Store) 不删除', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/sub': ['.DS_Store'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/sub', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('not-empty');
    });

    test('Thumbs.db 等系统文件不删除', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/sub': ['Thumbs.db', 'desktop.ini'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/sub', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('not-empty');
    });

    test('混合非视频残留文件不删除', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/sub': ['.DS_Store', 'metadata.nfo', 'poster.jpg', 'subtitle.srt'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/sub', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('not-empty');
    });
  });

  // ── Real-world inbox scenarios ──

  describe('真实收件箱场景', () => {
    test('电影文件直接在 Inbox 根目录 → 不删 Inbox', async () => {
      // User puts movie.mkv directly in /mnt/media/Inbox
      // After moving, Inbox might have other files
      const fs = createMockFs({
        '/mnt/media/Inbox': ['other-movie.mkv', 'random.txt'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('protected');
    });

    test('电影文件直接在 Inbox 根目录且 Inbox 为空 → 不删 Inbox', async () => {
      const fs = createMockFs({ '/mnt/media/Inbox': [] });
      const result = await cleanupSourceDir('/mnt/media/Inbox', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('protected');
    });

    test('电影在 Inbox 子目录（单文件） → 清理空目录', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/Movie (2024)': [],  // file already moved
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/Movie (2024)', fs);
      expect(result.deleted).toBe(true);
      expect(result.reason).toBe('deleted');
    });

    test('批量导入目录有多个电影 → 不删有视频的目录', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/batch-import': [
          'Movie A.mkv',   // this one was just processed
          'Movie B.mp4',   // this one hasn't been processed yet
        ],
      });
      // After processing Movie A (moved away), the array would actually be:
      // ['Movie B.mp4']
      // But we simulate the state after the file move
      const fs2 = createMockFs({
        '/mnt/media/Inbox/batch-import': ['Movie B.mp4'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/batch-import', fs2);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('has-video');
    });

    test('剧集目录 → 所有集处理完后才清理', async () => {
      // Simulates a TV show directory with episodes
      const fs = createMockFs({
        '/mnt/media/Inbox/TV.Show.S01': ['S01E05.mkv'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/TV.Show.S01', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('has-video');
    });

    test('剧集目录所有集处理完 → 清理空目录', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/TV.Show.S01': [],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/TV.Show.S01', fs);
      expect(result.deleted).toBe(true);
      expect(result.reason).toBe('deleted');
    });
  });

  // ── Multi-level directory scenarios ──

  describe('多层嵌套目录', () => {
    test('仅清理直接目录，不影响父目录', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/level1': ['level2'],  // level2 is a subdirectory name
        '/mnt/media/Inbox/level1/level2': [],
      });
      // Cleaning level2 should only remove level2
      const result = await cleanupSourceDir('/mnt/media/Inbox/level1/level2', fs);
      expect(result.deleted).toBe(true);
      // level1 is not touched
      expect(fs.tree['/mnt/media/Inbox/level1']).toBeDefined();
    });

    test('3 层嵌套 → 只清最内层', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/a': ['b'],
        '/mnt/media/Inbox/a/b': ['c'],
        '/mnt/media/Inbox/a/b/c': [],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/a/b/c', fs);
      expect(result.deleted).toBe(true);
      // Parent directories untouched
      expect(fs.tree['/mnt/media/Inbox/a/b']).toBeDefined();
      expect(fs.tree['/mnt/media/Inbox/a']).toBeDefined();
    });

    test('中间层有视频 → 不删中间层', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/show': ['episode.mkv', 'extras'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/show', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('has-video');
    });
  });

  // ── Error handling ──

  describe('错误处理', () => {
    test('目录已不存在 → 返回 error 不崩溃', async () => {
      const fs = createMockFs({});  // no directory exists
      const result = await cleanupSourceDir('/mnt/media/Inbox/ghost', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('error');
    });

    test('readdir 权限错误 → 返回 error 不崩溃', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/locked': ['file.txt'],
      });
      fs.failNextReaddir = true;
      const result = await cleanupSourceDir('/mnt/media/Inbox/locked', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('error');
    });

    test('并发删除（rmdir 失败） → 返回 error 不崩溃', async () => {
      // Simulate: readdir returns [], but by the time rmdir runs, dir is gone
      const mockFs: FileSystemOps = {
        readdir: async () => [],
        rmdir: async () => { throw new Error('ENOENT: already gone'); },
      };
      const result = await cleanupSourceDir('/mnt/media/Inbox/concurrent', mockFs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('error');
    });
  });

  // ── Edge cases ──

  describe('边界情况', () => {
    test('文件名类似视频但不是视频', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/sub': [
          'movie.mkv.txt',      // not a video
          'video.mp4.backup',   // not a video
          'notes-about-mkv',    // not a video
        ],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/sub', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('not-empty');
    });

    test('Unicode 目录名正常处理', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/一部未完成的电影 (2024)': [],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/一部未完成的电影 (2024)', fs);
      expect(result.deleted).toBe(true);
      expect(result.reason).toBe('deleted');
    });

    test('目录名含特殊字符', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/Movie [2024] (1080p)': [],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/Movie [2024] (1080p)', fs);
      expect(result.deleted).toBe(true);
      expect(result.reason).toBe('deleted');
    });

    test('目录名含空格', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/My Great Movie': [],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/My Great Movie', fs);
      expect(result.deleted).toBe(true);
      expect(result.reason).toBe('deleted');
    });

    test('.m4v 文件也算视频', async () => {
      const fs = createMockFs({
        '/mnt/media/Inbox/apple': ['itunes-movie.m4v'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/apple', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('has-video');
    });

    test('sample 视频文件也会阻止删除', async () => {
      // Even a sample.mkv should prevent deletion — we don't judge content
      const fs = createMockFs({
        '/mnt/media/Inbox/sub': ['sample.mkv'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/sub', fs);
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('has-video');
    });

    test('子目录名称在 entries 中（不是文件），不算视频', async () => {
      // readdir returns both files and subdirectory names
      // a subdirectory named "videos.mkv" (unlikely but edge case) — treated as entry
      const fs = createMockFs({
        '/mnt/media/Inbox/parent': ['subdir'],
      });
      const result = await cleanupSourceDir('/mnt/media/Inbox/parent', fs);
      // 'subdir' has no video extension, so it's not-empty but no video
      expect(result.deleted).toBe(false);
      expect(result.reason).toBe('not-empty');
    });
  });

  // ── Operation tracking ──

  describe('操作记录', () => {
    test('删除空目录 → 调用 readdir + rmdir', async () => {
      const fs = createMockFs({ '/mnt/media/Inbox/clean': [] });
      await cleanupSourceDir('/mnt/media/Inbox/clean', fs);
      expect(fs.ops).toEqual([
        { type: 'readdir', path: '/mnt/media/Inbox/clean' },
        { type: 'rmdir', path: '/mnt/media/Inbox/clean' },
      ]);
    });

    test('有视频 → 只调用 readdir', async () => {
      const fs = createMockFs({ '/mnt/media/Inbox/vids': ['movie.mkv'] });
      await cleanupSourceDir('/mnt/media/Inbox/vids', fs);
      expect(fs.ops).toEqual([
        { type: 'readdir', path: '/mnt/media/Inbox/vids' },
      ]);
    });

    test('保护目录 → 不调用任何 fs 操作', async () => {
      const fs = createMockFs({ '/mnt/media/Inbox': [] });
      await cleanupSourceDir('/mnt/media/Inbox', fs);
      expect(fs.ops).toEqual([]);
    });
  });
});
