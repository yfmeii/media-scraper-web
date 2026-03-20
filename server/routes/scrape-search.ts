import type { Context } from 'hono';
import { DEFAULT_LANGUAGE } from '@media-scraper/shared/constants';
import { findBestMatch, findBestMatchMixed, findByImdbId, searchMovie, searchMulti, searchTV } from '../lib/tmdb';
import { parseFilename } from '../lib/scanner-parser';
import { buildMatchPayload, mapSearchResult, type SearchKind } from './scrape-helpers';
import { type ParseResult } from './scrape-request';
import { buildImdbSearchResponse, buildMatchNotFoundResponse, buildSearchResponse } from './scrape-response';
import { badRequest } from './route-utils';

function parseSearchParams(query: { q?: string; year?: string; language?: string }): ParseResult<{
  query: string;
  year?: number;
  language: string;
}> {
  if (!query.q) {
    return { ok: false, error: 'Missing query parameter' };
  }

  return {
    ok: true,
    data: {
      query: query.q,
      year: query.year ? parseInt(query.year, 10) : undefined,
      language: query.language || DEFAULT_LANGUAGE,
    },
  };
}

function parseImdbSearchParams(query: { imdb_id?: string; id?: string; language?: string }): ParseResult<{
  imdbId: string;
  language: string;
}> {
  const imdbId = query.imdb_id || query.id;
  if (!imdbId) {
    return { ok: false, error: 'Missing imdb_id parameter' };
  }

  return {
    ok: true,
    data: {
      imdbId,
      language: query.language || DEFAULT_LANGUAGE,
    },
  };
}

function parseMatchBody(body: any): ParseResult<{
  path: string;
  kind: 'tv' | 'movie' | undefined;
  title?: string;
  year?: number;
  language: string;
}> {
  const { path, kind: inputKind, title, year, language = DEFAULT_LANGUAGE } = body;
  if (!path) {
    return { ok: false, error: 'Missing path' };
  }

  return {
    ok: true,
    data: {
      path,
      kind: inputKind === 'tv' || inputKind === 'movie' ? inputKind : undefined,
      title,
      year,
      language,
    },
  };
}

export async function handleSearch(c: Context, kind: SearchKind) {
  const parsed = parseSearchParams({
    q: c.req.query('q'),
    year: c.req.query('year'),
    language: c.req.query('language'),
  });
  if (!parsed.ok) {
    return badRequest(c, parsed.error);
  }

  const { query, year, language } = parsed.data;
  const results = kind === 'tv'
    ? await searchTV(query, year, language)
    : kind === 'movie'
      ? await searchMovie(query, year, language)
      : await searchMulti(query, year, language);

  return c.json(buildSearchResponse(kind, results));
}

export async function handleSearchByImdb(c: Context) {
  const parsed = parseImdbSearchParams({
    imdb_id: c.req.query('imdb_id'),
    id: c.req.query('id'),
    language: c.req.query('language'),
  });
  if (!parsed.ok) {
    return badRequest(c, parsed.error);
  }

  const matched = await findByImdbId(parsed.data.imdbId, parsed.data.language);
  return c.json(buildImdbSearchResponse(matched));
}

export async function handleMatch(c: Context) {
  const parsedBody = parseMatchBody(await c.req.json());
  if (!parsedBody.ok) {
    return badRequest(c, parsedBody.error);
  }

  const { path, kind, title, year, language } = parsedBody.data;
  const parsed = parseFilename(path.split('/').pop() || '');
  const searchTitle = title || parsed.title;
  const searchYear = year || parsed.year;

  if (!searchTitle) {
    return badRequest(c, 'Could not determine title');
  }

  const match = kind
    ? await findBestMatch(kind, searchTitle, searchYear, language)
    : await findBestMatchMixed(searchTitle, searchYear, language);

  if (!match) {
    return c.json(buildMatchNotFoundResponse(searchTitle, searchYear));
  }

  return c.json({
    success: true,
    data: buildMatchPayload(match, kind),
  });
}
