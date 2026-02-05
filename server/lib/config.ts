// Media file extensions
export const VIDEO_EXTS = new Set(['.mkv', '.mp4', '.m4v', '.avi', '.mov']);
export const SUB_EXTS = new Set(['.srt', '.ass', '.ssa', '.sub']);
export const NFO_EXTS = new Set(['.nfo']);

// Directory paths (can be overridden by environment variables)
export const MEDIA_PATHS = {
  inbox: process.env.INBOX_PATH || '/mnt/media/Inbox',
  tv: process.env.TV_PATH || '/mnt/media/TV',
  movies: process.env.MOVIES_PATH || '/mnt/media/Movies',
};

// API Keys - should be set via environment variables
export const TMDB_API_KEY = process.env.TMDB_API_KEY || '';

// 路径识别 Dify API (可选)
export const DIFY_PATH_RECOGNIZER_KEY = process.env.DIFY_PATH_RECOGNIZER_KEY || '';
export const DIFY_BASE_URL = process.env.DIFY_URL || 'https://api.dify.ai/v1/chat-messages';

// Validate required environment variables
if (!TMDB_API_KEY) {
  console.warn('Warning: TMDB_API_KEY is not set. TMDB features will not work.');
}

// Tag patterns for parsing
export const RESOLUTION_TAGS = new Set(['2160p', '1080p', '720p', '480p', '4k', '8k']);
export const SOURCE_TAGS = new Set(['bluray', 'blu-ray', 'bdrip', 'remux', 'web-dl', 'webrip', 'hdtv', 'dvdrip', 'atvp', 'dsnp', 'nf']);
export const CODEC_TAGS = new Set(['x265', 'h265', 'hevc', 'x264', 'h264', 'avc']);
export const AUDIO_TAGS = new Set(['ddp', 'ddp5.1', 'ddp7.1', 'dts', 'truehd', 'atmos', 'aac', 'flac', 'ac3']);

// Episode patterns
export const EP_PATTERNS = [
  /[Ss](\d{1,2})[Ee](\d{1,3})(?:[Ee](\d{1,3}))?/,
  /(\d{1,2})x(\d{1,3})/i,
  /(?:\bEP|\bE)(\d{1,3})/i,
  /第\s*(\d{1,3})\s*[集话話]/,
];

// NFO generator signature
export const NFO_GENERATOR = 'media-scraper-web';
