import { readdir } from 'fs/promises';
import { join } from 'path';

export type LibraryDetailMode = 'summary' | 'full';

export async function scanLibrary<T>(
  rootPath: string,
  buildInfo: (entryPath: string, entryName: string) => Promise<T | null>,
  sortByName: (items: T[]) => T[],
): Promise<T[]> {
  const items: T[] = [];

  try {
    const entries = await readdir(rootPath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const entryPath = join(rootPath, entry.name);
      const item = await buildInfo(entryPath, entry.name);
      if (item) items.push(item);
    }
  } catch (error) {
    console.error(`Error scanning ${rootPath}:`, error);
  }

  return sortByName(items);
}

export function sortByDisplayName<T extends { name: string }>(items: T[]): T[] {
  return items.sort((a, b) => a.name.localeCompare(b.name));
}
