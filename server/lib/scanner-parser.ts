import { extname } from 'path';
import type { ParsedInfo } from '@media-scraper/shared/types';
import { AUDIO_TAGS, CODEC_TAGS, EP_PATTERNS, RESOLUTION_TAGS, SOURCE_TAGS } from './config';

export function parseFilename(filename: string): ParsedInfo {
  const name = filename.replace(extname(filename), '');
  const tokens = name.replace(/[.\-_\[\](){}]/g, ' ').split(/\s+/).filter(Boolean);

  let title = '';
  let year: number | undefined;
  let season: number | undefined;
  let episode: number | undefined;
  let episodeEnd: number | undefined;
  let resolution: string | undefined;
  let source: string | undefined;
  let codec: string | undefined;

  for (const pattern of EP_PATTERNS) {
    const match = name.match(pattern);
    if (match) {
      if (pattern.source.startsWith('[Ss]')) {
        season = parseInt(match[1]);
        episode = parseInt(match[2]);
        if (match[3]) episodeEnd = parseInt(match[3]);
      } else if (pattern.source.startsWith('(\\d')) {
        season = parseInt(match[1]);
        episode = parseInt(match[2]);
      } else {
        season = 1;
        episode = parseInt(match[1]);
      }
      break;
    }
  }

  const titleTokens: string[] = [];
  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (/^[Ss]\d{1,2}[Ee]\d{1,3}/.test(token)) break;
    if (/^\d{1,2}x\d{1,3}$/.test(token)) break;
    if (/^(?:EP|E)\d{1,3}$/i.test(token)) break;

    if (RESOLUTION_TAGS.has(lower)) {
      resolution = lower;
      break;
    }

    if (SOURCE_TAGS.has(lower)) {
      source = lower;
      continue;
    }
    if (CODEC_TAGS.has(lower)) {
      codec = lower;
      continue;
    }
    if (AUDIO_TAGS.has(lower)) continue;

    if (/^\d{4}$/.test(token)) {
      const y = parseInt(token);
      if (y >= 1900 && y <= 2099) {
        year = y;
        continue;
      }
    }

    titleTokens.push(token);
  }

  title = titleTokens.join(' ').trim();

  return { title, year, season, episode, episodeEnd, resolution, source, codec };
}

export function parseFromPath(relativePath: string): ParsedInfo {
  const parts = relativePath.split('/');
  const filename = parts[parts.length - 1];
  const parsed = parseFilename(filename);

  if (parsed.episode === undefined) {
    const baseName = filename.replace(extname(filename), '');
    const epMatch = baseName.match(/^(\d{1,3})$/);
    if (epMatch) {
      parsed.episode = parseInt(epMatch[1]);
      if (!parsed.season) parsed.season = 1;
    }

    const epMatch2 = baseName.match(/^[Ee][Pp]?(\d{1,3})$/);
    if (epMatch2) {
      parsed.episode = parseInt(epMatch2[1]);
      if (!parsed.season) parsed.season = 1;
    }
  }

  return parsed;
}
