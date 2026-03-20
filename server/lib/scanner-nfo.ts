import { stat } from 'fs/promises';
import { NFO_GENERATOR } from './config';

export interface NfoDetails {
  overview?: string;
  tagline?: string;
  runtime?: number;
  voteAverage?: number;
  status?: string;
  year?: number;
  thumbUrl?: string;
}

async function isProcessed(nfoPath: string): Promise<boolean> {
  try {
    const content = await Bun.file(nfoPath).text();
    return content.includes(`<generator>${NFO_GENERATOR}</generator>`);
  } catch {
    return false;
  }
}

function decodeXml(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function extractNfoTag(content: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i');
  const match = content.match(regex);
  if (!match) return undefined;
  const value = decodeXml(match[1]).trim();
  return value.length ? value : undefined;
}

function extractPosterUrlFromNfo(content: string): string | undefined {
  const thumbs: Array<{ url: string; aspect?: string }> = [];
  const thumbRegex = /<thumb([^>]*)>([\s\S]*?)<\/thumb>/gi;
  let match: RegExpExecArray | null = thumbRegex.exec(content);

  while (match) {
    const attrs = match[1] || '';
    const rawValue = decodeXml(match[2] || '').trim();
    const aspectMatch = attrs.match(/\baspect\s*=\s*["']([^"']+)["']/i);
    const aspect = aspectMatch?.[1]?.toLowerCase();
    if (/^https?:\/\//i.test(rawValue)) {
      thumbs.push({ url: rawValue, aspect });
    }
    match = thumbRegex.exec(content);
  }

  if (!thumbs.length) return undefined;

  const isImdbPoster = (url: string) =>
    /(?:imdb\.com|media-amazon\.com|amazonaws\.com\/images\/M\/)/i.test(url);

  return thumbs.find(item => item.aspect === 'poster' && isImdbPoster(item.url))?.url
    || thumbs.find(item => isImdbPoster(item.url))?.url
    || thumbs.find(item => item.aspect === 'poster')?.url
    || thumbs[0]?.url;
}

export async function extractNfoDetails(nfoPath: string): Promise<NfoDetails | null> {
  try {
    const content = await Bun.file(nfoPath).text();
    const overview = extractNfoTag(content, 'plot');
    const tagline = extractNfoTag(content, 'tagline');
    const status = extractNfoTag(content, 'status');
    const ratingValue = extractNfoTag(content, 'rating');
    const runtimeValue = extractNfoTag(content, 'runtime');
    const yearValue = extractNfoTag(content, 'year');
    const premieredValue = extractNfoTag(content, 'premiered');
    const thumbUrl = extractPosterUrlFromNfo(content);

    const runtime = runtimeValue ? parseInt(runtimeValue, 10) : undefined;
    const voteAverage = ratingValue ? parseFloat(ratingValue) : undefined;
    let year = yearValue ? parseInt(yearValue, 10) : undefined;
    if (!year && premieredValue) {
      const yearMatch = premieredValue.match(/^(\d{4})/);
      if (yearMatch) year = parseInt(yearMatch[1], 10);
    }

    return {
      overview,
      tagline,
      runtime: Number.isFinite(runtime) ? runtime : undefined,
      voteAverage: Number.isFinite(voteAverage) ? voteAverage : undefined,
      status,
      year: Number.isFinite(year) ? year : undefined,
      thumbUrl,
    };
  } catch {
    return null;
  }
}

export async function getNfoStatus(nfoPath: string): Promise<{ hasNfo: boolean; processed: boolean; tmdbId?: number }> {
  try {
    await stat(nfoPath);
    return { hasNfo: true, processed: await isProcessed(nfoPath) };
  } catch {
    return { hasNfo: false, processed: false };
  }
}

export async function extractTmdbIdFromNfo(nfoPath: string): Promise<number | undefined> {
  try {
    const content = await Bun.file(nfoPath).text();
    const match = content.match(/<tmdbid>(\d+)<\/tmdbid>/);
    return match ? parseInt(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

export async function getNfoStatusWithTmdb(
  nfoPath: string,
): Promise<{ hasNfo: boolean; processed: boolean; tmdbId?: number }> {
  const status = await getNfoStatus(nfoPath);
  if (!status.hasNfo) return { ...status, tmdbId: undefined };

  const tmdbId = await extractTmdbIdFromNfo(nfoPath);
  return { ...status, tmdbId };
}
