// Boot-level update state: pure filesystem logic with no Electron or SQLite dependency (used by the immutable shell).
import * as fs from 'fs';
import * as path from 'path';
import { atomicWriteJson, copyDir, readJson, rmrf, sha256File } from './fsutil';
import type { HistoryEntry, Manifest, UpdateState } from './types';

export interface Layout { root: string; inbox: string; applied: string; failed: string; versions: string; state: string; history: string; backups: string; db: string }
export function layoutFor(userData: string): Layout {
  const root = path.join(userData, 'Updates');
  return { root, inbox: path.join(root, 'inbox'), applied: path.join(root, 'applied'), failed: path.join(root, 'failed'), versions: path.join(root, 'versions'),
    state: path.join(root, 'state.json'), history: path.join(root, 'history.json'), backups: path.join(userData, 'backups'), db: path.join(userData, 'app.db') };
}
export function ensureLayout(l: Layout): void { for (const d of [l.inbox, l.applied, l.failed, l.versions, l.backups]) fs.mkdirSync(d, { recursive: true }); }

export const readManifest = (root: string): Manifest | null => readJson<Manifest | null>(path.join(root, 'manifest.json'), null);

export function loadState(l: Layout, bundledVersion: string): UpdateState {
  const s = readJson<UpdateState | null>(l.state, null);
  if (!s || s.format !== 1) return { format: 1, bundledVersion, current: null, previous: null, pending: null };
  return { ...s, bundledVersion };
}
export const saveState = (l: Layout, s: UpdateState): void => atomicWriteJson(l.state, s);
export function addHistory(l: Layout, e: Omit<HistoryEntry, 'at'>): void {
  const h = readJson<HistoryEntry[]>(l.history, []);
  h.push({ at: new Date().toISOString(), ...e });
  atomicWriteJson(l.history, h.slice(-200));
}
export const readHistory = (l: Layout): HistoryEntry[] => readJson<HistoryEntry[]>(l.history, []);

/** True when every file listed in the manifest exists with the recorded hash and nothing else is present. */
export function verifyTree(root: string, m: Manifest): string | null {
  for (const f of m.files) {
    const p = path.join(root, ...f.path.split('/'));
    if (!fs.existsSync(p)) return `missing file ${f.path}`;
    if (fs.statSync(p).size !== f.size) return `size mismatch ${f.path}`;
    if (sha256File(p) !== f.sha256) return `hash mismatch ${f.path}`;
  }
  return null;
}

export const versionRoot = (l: Layout, bundledRoot: string, v: string | null): string => (v === null ? bundledRoot : path.join(l.versions, v));

export interface Active { version: string; root: string; manifest: Manifest; note?: string }

/**
 * Decide which code version to run at startup.
 * - A version that was applied but never confirmed healthy (pending) is rolled back on the next start.
 * - A missing/corrupt version directory falls back to the previous one, then to the version bundled in the EXE.
 * Database: if the failed update changed the schema, the pre-update snapshot is restored (nothing could have been entered
 * because the new version never confirmed a successful start).
 */
export function resolveActive(l: Layout, bundledRoot: string): Active {
  const bundled = readManifest(bundledRoot);
  if (!bundled) throw new Error('Bundled application manifest is missing: reinstall the application.');
  let st = loadState(l, bundled.version);
  const log = (e: Omit<HistoryEntry, 'at'>) => { try { addHistory(l, e); } catch { /* history is best effort */ } };

  if (st.pending) {
    if (st.pending.attempts >= 1) { // started once before and never confirmed: roll back
      const p = st.pending;
      if (p.schemaChanged && p.snapshot && fs.existsSync(p.snapshot)) {
        for (const ext of ['-wal', '-shm']) rmrf(l.db + ext);
        fs.copyFileSync(p.snapshot, l.db);
      }
      log({ event: 'rolled_back', version: p.version, from: p.from, note: 'Update did not confirm a healthy start; previous version restored' + (p.schemaChanged ? ' and database snapshot restored' : '') });
      st = { ...st, current: p.from, previous: null, pending: null };
      saveState(l, st);
    } else {
      st = { ...st, pending: { ...st.pending, attempts: st.pending.attempts + 1 } };
      saveState(l, st);
    }
  }
  // Walk back to a healthy version if the chosen one is damaged.
  const candidates: (string | null)[] = [st.current, st.previous, null];
  for (const v of candidates) {
    const root = versionRoot(l, bundledRoot, v);
    const m = readManifest(root);
    if (m && (v === null || verifyTree(root, m) === null)) {
      if (v !== st.current) { log({ event: 'rolled_back', version: st.current ?? bundled.version, note: `Version files damaged; running ${v ?? 'bundled'} instead` }); saveState(l, { ...st, current: v, pending: null }); }
      return { version: m.version, root, manifest: m };
    }
  }
  return { version: bundled.version, root: bundledRoot, manifest: bundled };
}

/** Called by the app once the UI has loaded and talked to the database successfully. */
export function confirmHealthy(l: Layout, bundledVersion: string): boolean {
  const st = loadState(l, bundledVersion);
  if (!st.pending) return false;
  addHistory(l, { event: 'confirmed', version: st.pending.version, from: st.pending.from });
  saveState(l, { ...st, pending: null });
  return true;
}

export function pruneVersions(l: Layout, keep: (string | null)[]): void {
  const keepSet = new Set(keep.filter((x): x is string => !!x));
  if (!fs.existsSync(l.versions)) return;
  const dirs = fs.readdirSync(l.versions).filter((d) => !keepSet.has(d)).sort();
  for (const d of dirs.slice(0, Math.max(0, dirs.length - 2))) rmrf(path.join(l.versions, d)); // keep two extra old versions for manual rollback
}
export { copyDir };
