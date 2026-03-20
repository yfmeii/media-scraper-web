import { beforeEach, describe, expect, test } from 'bun:test';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('library cache policy', () => {
  const root = join(tmpdir(), `media-cache-${Date.now()}`);

  beforeEach(async () => {
    await rm(root, { recursive: true, force: true });
    await mkdir(root, { recursive: true });
  });

  test('placeholder', async () => {
    const showDir = join(root, 'Show');
    await mkdir(showDir, { recursive: true });
    await writeFile(join(showDir, 'tvshow.nfo'), '<tvshow />', 'utf8');
    expect(true).toBe(true);
  });
});
