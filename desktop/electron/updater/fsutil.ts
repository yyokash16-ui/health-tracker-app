import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export const sha256File = (p: string): string => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export const sha256 = (b: Buffer | string): string => crypto.createHash('sha256').update(b).digest('hex');

/** Write via temp file + rename so readers never see a half-written file (atomic on the same volume). */
export function atomicWrite(file: string, data: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, data as any); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
}
export const atomicWriteJson = (file: string, v: unknown): void => atomicWrite(file, JSON.stringify(v, null, 2));
export function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; } catch { return fallback; }
}
export function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
export const rmrf = (p: string): void => fs.rmSync(p, { recursive: true, force: true });
export function listFiles(root: string, rel = ''): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listFiles(root, r)); else out.push(r);
  }
  return out.sort();
}
/** Reject absolute paths, drive letters, backslashes and '..' (zip-slip). */
export function safeRel(p: string): string {
  if (!p || p.includes('\\') || p.startsWith('/') || /^[A-Za-z]:/.test(p) || p.split('/').some((s) => s === '..' || s === '' || s === '.'))
    throw new Error(`Unsafe path in update package: ${p}`);
  return p;
}
export function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d < 0 ? -1 : 1; }
  return 0;
}
export const isVersion = (v: unknown): v is string => typeof v === 'string' && /^\d+\.\d+\.\d+$/.test(v);
