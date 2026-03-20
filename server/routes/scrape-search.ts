import type { Context } from 'hono';
import { findBestMatch, findBestMatchMixed, findByImdbId, searchMovie, searchMulti, searchTV } from '../lib/tmdb';
import { parseFilename } from '../lib/scanner-parser';
import { buildMatchPayload, mapSearchResult, type SearchKind } from './scrape-helpers';
import { parseImdbSearchParams, parseMatchBody, parseSearchParams } from './scrape-request';
import { buildImdbSearchResponse, buildMatchNotFoundResponse, buildSearchResponse } from './scrape-response';
import { badRequest } from './route-utils';

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
