export const APP_ID = 'com.local.healthtracker';
export const SHELL_VERSION = 1; // protocol version of the immutable shell (electron/shell.ts). Packages declare the minimum they need.

export interface ManifestFile { path: string; sha256: string; size: number }
export interface Manifest {
  format: 1;
  appId: string;
  version: string;
  /** null = full package (works on top of any version); otherwise the version this delta must be applied on. */
  baseVersion: string | null;
  minShellVersion: number;
  /** Highest database schema version the code in this package understands. */
  schemaVersion: number;
  /** True when main-process code or the preload changed (restart needed); false = UI only (window reload). */
  requiresRestart: boolean;
  createdAt: string;
  notes: string;
  /** Complete file list of the resulting version (exact tree). */
  files: ManifestFile[];
  /** Subset of `files` shipped inside this package (the rest is taken from the base version). */
  changed: string[];
}

export interface Pending { version: string; from: string | null; attempts: number; schemaChanged: boolean; snapshot: string | null; startedAt: string }
export interface UpdateState { format: 1; bundledVersion: string; current: string | null; previous: string | null; pending: Pending | null }
export interface HistoryEntry { at: string; event: 'applied' | 'confirmed' | 'rolled_back' | 'rejected' | 'manual_rollback'; version: string; from?: string | null; note?: string }
