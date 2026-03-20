import type { MediaFile, ParsedInfo, SearchResult } from './types';

export function getInboxSearchKeyword(file: Pick<MediaFile, 'name' | 'parsed'>): string {
  return file.parsed.title || file.name.replace(/\.[^/.]+$/, '');
}

export function getInboxRecognizeInput(file: Pick<MediaFile, 'path' | 'relativePath'>): string {
  return file.relativePath || file.path;
}

export function inferMediaTypeFromParsed(parsed: ParsedInfo | null | undefined): 'tv' | 'movie' {
  if (!parsed) return 'movie';
  return parsed.season !== undefined || parsed.episode !== undefined ? 'tv' : 'movie';
}

export function inferCandidateMediaType(
  candidate: Pick<SearchResult, 'mediaType' | 'firstAirDate' | 'releaseDate'> | null | undefined,
  fallback: 'tv' | 'movie' = 'movie',
): 'tv' | 'movie' {
  if (candidate?.mediaType === 'tv' || candidate?.mediaType === 'movie') return candidate.mediaType;
  if (candidate?.firstAirDate && !candidate?.releaseDate) return 'tv';
  if (candidate?.releaseDate && !candidate?.firstAirDate) return 'movie';
  return fallback;
}

export function mergeSearchResults(...groups: SearchResult[][]): SearchResult[] {
  const merged: SearchResult[] = [];
  const seen = new Set<number>();
  for (const group of groups) {
    for (const item of group) {
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

export function moveSearchResultToFront(
  list: SearchResult[],
  preferredId: number | null | undefined,
): SearchResult[] {
  if (!preferredId) return list;
  const idx = list.findIndex(item => item.id === preferredId);
  if (idx <= 0) return list;
  const copy = list.slice();
  const [hit] = copy.splice(idx, 1);
  copy.unshift(hit);
  return copy;
}
