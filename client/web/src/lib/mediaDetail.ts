export function detailDelay(index: number, step = 60, base = 200): number {
  return index * step + base;
}

export function getFanartUrl(path?: string, hasFanart?: boolean): string | undefined {
  if (!path || !hasFanart) return undefined;
  return `/api/media/poster?path=${encodeURIComponent(`${path}/fanart.jpg`)}`;
}

export function copyPath(path?: string): void {
  if (!path) return;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(path).catch(() => {});
    return;
  }

  if (typeof document === 'undefined') return;

  try {
    const textarea = document.createElement('textarea');
    textarea.value = path;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  } catch {
    // Ignore copy failures
  }
}
