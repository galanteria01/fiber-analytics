import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ObjectStore } from './types.js';

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

/**
 * Filesystem-backed {@link ObjectStore}. Object keys map to paths under a root
 * directory; DuckDB reads these paths directly. This is the default adapter so
 * local development needs no cloud dependency.
 */
export class LocalObjectStore implements ObjectStore {
  readonly kind = 'local' as const;

  constructor(private readonly root: string) {}

  private full(key: string): string {
    return path.join(this.root, key);
  }

  async put(key: string, body: string | Uint8Array): Promise<void> {
    const target = this.full(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async get(key: string): Promise<string> {
    return readFile(this.full(key), 'utf8');
  }

  async list(prefix: string): Promise<string[]> {
    const base = this.full(prefix);
    const keys: string[] = [];
    const walk = async (dir: string): Promise<void> => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(abs);
        } else if (entry.isFile()) {
          keys.push(toPosix(path.relative(this.root, abs)));
        }
      }
    };
    await walk(base);
    return keys;
  }

  async delete(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => rm(this.full(key), { force: true })));
  }

  async move(fromKey: string, toKey: string): Promise<void> {
    const to = this.full(toKey);
    await mkdir(path.dirname(to), { recursive: true });
    await rename(this.full(fromKey), to);
  }

  uri(key: string): string {
    return toPosix(this.full(key));
  }

  glob(prefix: string, pattern: string): string {
    return `${toPosix(this.full(prefix))}/**/${pattern}`;
  }

  writeTarget(prefix: string): string {
    return toPosix(this.full(prefix));
  }

  duckdbSetup(): string[] {
    return [];
  }
}
