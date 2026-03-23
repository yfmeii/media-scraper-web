import { extname } from 'path';
import type { ParsedInfo } from '@media-scraper/shared/types';
import { AUDIO_TAGS, CODEC_TAGS, EP_PATTERNS, RESOLUTION_TAGS, SOURCE_TAGS } from './config';

const ANIME_SPECIAL_PATTERNS = [
  /\[(NCOP|NCED)\d*\]/i,
  /\[(OP|ED)\d*\]/i,
  /\[(SP|SPECIAL|OVA|OAD|PV|CM)\d*\]/i,
  /(?:\s+-\s+|\s+)(?:NCOP|NCED)\s*\d*/i,
  /(?:\s+-\s+|\s+)(?:OP|ED)\s*\d*/i,
  /(?:\s+-\s+|\s+)(?:SP|SPECIAL|OVA|OAD|PV|CM)\s*\d*/i,
];

const TITLE_SEASON_RULES: Array<{ pattern: RegExp, season: number }> = [
  { pattern: /jojo'?s bizarre adventure\s+-?\s*phantom blood/i, season: 1 },
  { pattern: /jojo'?s bizarre adventure\s+-?\s*battle tendency/i, season: 1 },
  { pattern: /jojo'?s bizarre adventure\s+-?\s*stardust crusaders/i, season: 2 },
  { pattern: /jojo'?s bizarre adventure\s+-?\s*diamond is unbreakable/i, season: 3 },
  { pattern: /jojo'?s bizarre adventure\s+-?\s*golden wind/i, season: 4 },
  { pattern: /jojo'?s bizarre adventure\s+-?\s*stone ocean/i, season: 5 },
];

function inferSeasonFromTitle(title: string): number | undefined {
  for (const rule of TITLE_SEASON_RULES) {
    if (rule.pattern.test(title)) return rule.season;
  }
  return undefined;
}

function extractAnimeTitleCandidate(normalizedName: string, titleBoundary: number): string {
  if (titleBoundary >= normalizedName.length) return '';
  return normalizedName.slice(0, titleBoundary).replace(/[.\-_]+/g, ' ').trim();
}

function cleanAnimeTitle(title: string): string {
  return title.replace(/\s+-\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

function isAnimeStyleEpisodeContext(normalizedName: string): boolean {
  return / - /.test(normalizedName) || /^\[[^\]]+\]\s*/.test(normalizedName);
}

function inferSeasonFromPathParts(parts: string[]): number | undefined {
  for (let index = parts.length - 1; index >= 0; index--) {
    const normalizedPart = parts[index].replace(/[._-]+/g, ' ').trim();
    const seasonMatch = normalizedPart.match(/(?:^|\b)season\s*(\d{1,2})(?:\b|$)/i)
      || normalizedPart.match(/(?:^|\b)s(\d{1,2})(?:\b|$)/i);

    if (seasonMatch) {
      return parseInt(seasonMatch[1]);
    }
  }

  return undefined;
}

function isBareEpisodeName(baseName: string): boolean {
  return /^(?:\d{1,3}|[Ee][Pp]?\d{1,3})$/.test(baseName);
}

export function parseFilename(filename: string): ParsedInfo {
  const name = filename.replace(extname(filename), '');
  const tokens = name.replace(/[.\-_\[\](){}]/g, ' ').split(/\s+/).filter(Boolean);
  const normalizedName = name.replace(/^\[[^\]]+\]\s*/, '').trim();

  let title = '';
  let year: number | undefined;
  let season: number | undefined;
  let episode: number | undefined;
  let episodeEnd: number | undefined;
  let resolution: string | undefined;
  let source: string | undefined;
  let codec: string | undefined;
  let titleBoundary = normalizedName.length;
  let hasAnimeSpecialTag = false;
  let hasExplicitSeason = false;

  for (const pattern of EP_PATTERNS) {
    const match = normalizedName.match(pattern);
    if (match) {
      if (pattern.source.startsWith('[Ss]')) {
        season = parseInt(match[1]);
        episode = parseInt(match[2]);
        if (match[3]) episodeEnd = parseInt(match[3]);
        hasExplicitSeason = true;
      } else if (pattern.source.startsWith('(\\d')) {
        season = parseInt(match[1]);
        episode = parseInt(match[2]);
        hasExplicitSeason = true;
      } else {
        season = 1;
        episode = parseInt(match[1]);
      }
      titleBoundary = normalizedName.indexOf(match[0]);
      break;
    }
  }

  for (const pattern of ANIME_SPECIAL_PATTERNS) {
    const match = normalizedName.match(pattern);
    if (!match) continue;
    hasAnimeSpecialTag = true;
    titleBoundary = Math.min(titleBoundary, normalizedName.indexOf(match[0]));
    break;
  }

  if (episode === undefined && !hasAnimeSpecialTag) {
    const animeEpisodeMatch = normalizedName.match(/(?:\s+-\s+|\s+)\[(\d{1,3})(?:v\d+)?(?:-(\d{1,3})(?:v\d+)?)?\](?=(?:\s|\[|\(|\{|$))/i);
    if (animeEpisodeMatch) {
      season = 1;
      episode = parseInt(animeEpisodeMatch[1]);
      if (animeEpisodeMatch[2]) episodeEnd = parseInt(animeEpisodeMatch[2]);
      titleBoundary = normalizedName.indexOf(animeEpisodeMatch[0]);
    }
  }

  if (episode === undefined && !hasAnimeSpecialTag && isAnimeStyleEpisodeContext(normalizedName)) {
    const animeRevisionMatch = normalizedName.match(/\s-\s(\d{1,3})(?:v\d+)?(?=(?:\s|\[|\(|\{|$))/i);
    if (animeRevisionMatch) {
      season = 1;
      episode = parseInt(animeRevisionMatch[1]);
      titleBoundary = normalizedName.indexOf(animeRevisionMatch[0]);
    }
  }

  const animeTitleCandidate = extractAnimeTitleCandidate(normalizedName, titleBoundary);

  if (animeTitleCandidate) {
    title = cleanAnimeTitle(animeTitleCandidate);
  } else {
    const titleTokens: string[] = [];
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index];
      const lower = token.toLowerCase();
      const nextLower = tokens[index + 1]?.toLowerCase();

      if (/^[Ss]\d{1,2}[Ee]\d{1,3}/.test(token)) break;
      if (/^\d{1,2}x\d{1,3}$/.test(token)) break;
      if (/^(?:EP|E)\d{1,3}$/i.test(token)) break;

      if (RESOLUTION_TAGS.has(lower)) break;

      if (lower === 'web' && nextLower === 'dl') {
        source = source ?? 'web-dl';
        index++;
        continue;
      }

      if (SOURCE_TAGS.has(lower)) continue;
      if (CODEC_TAGS.has(lower)) continue;
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
  }

  if (title) {
    const inferredSeason = inferSeasonFromTitle(title);
    if (inferredSeason !== undefined && !hasExplicitSeason) {
      season = inferredSeason;
    }
  }

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    const lower = token.toLowerCase();
    const nextLower = tokens[index + 1]?.toLowerCase();

    if (RESOLUTION_TAGS.has(lower) && resolution === undefined) {
      resolution = lower;
      continue;
    }

    if (lower === 'web' && nextLower === 'dl' && source === undefined) {
      source = 'web-dl';
      index++;
      continue;
    }

    if (SOURCE_TAGS.has(lower) && source === undefined) {
      source = lower;
      continue;
    }
    if (CODEC_TAGS.has(lower) && codec === undefined) {
      codec = lower;
      continue;
    }

    if (/^\d{4}$/.test(token) && year === undefined) {
      const y = parseInt(token);
      if (y >= 1900 && y <= 2099) year = y;
    }
  }

  return { title, year, season, episode, episodeEnd, resolution, source, codec };
}

export function parseFromPath(relativePath: string): ParsedInfo {
  const parts = relativePath.split('/');
  const filename = parts[parts.length - 1];
  const parsed = parseFilename(filename);
  const seasonFromPath = inferSeasonFromPathParts(parts.slice(0, -1));
  const baseName = filename.replace(extname(filename), '');

  if ((parsed.season === undefined || isBareEpisodeName(baseName)) && seasonFromPath !== undefined) {
    parsed.season = seasonFromPath;
  }

  if (parsed.episode === undefined) {
    const epMatch = baseName.match(/^(\d{1,3})$/);
    if (epMatch) {
      parsed.episode = parseInt(epMatch[1]);
      if (!parsed.season) parsed.season = seasonFromPath ?? 1;
    }

    const epMatch2 = baseName.match(/^[Ee][Pp]?(\d{1,3})$/);
    if (epMatch2) {
      parsed.episode = parseInt(epMatch2[1]);
      if (!parsed.season) parsed.season = seasonFromPath ?? 1;
    }
  }

  return parsed;
}
