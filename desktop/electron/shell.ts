// IMMUTABLE SHELL: the only code inside the .exe's asar that decides which application version to run.
// Kept tiny and stable on purpose. Everything else (UI, main-process logic, migrations, food data) is delivered by update packages.
import { app, dialog } from 'electron';
import * as path from 'path';
import Module from 'module';
import { SHELL_VERSION } from './updater/types';
import { ensureLayout, layoutFor, loadState, readManifest, resolveActive, saveState, type Active } from './updater/state';

const dev = process.env.HT_DEV === '1';
const appPath = app.getAppPath();
const bundledRoot = path.join(appPath, 'dist-app');

// Lets code that lives in an update folder (outside the asar) find the native better-sqlite3 module shipped in the .exe.
process.env.NODE_PATH = [path.join(appPath, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
(Module as unknown as { _initPaths(): void })._initPaths();

const layout = layoutFor(app.getPath('userData'));
let active: Active;
try {
  if (dev) active = { version: 'dev', root: bundledRoot, manifest: undefined as never };
  else { ensureLayout(layout); active = resolveActive(layout, bundledRoot); }
} catch (e) {
  app.whenReady().then(() => { dialog.showErrorBox('Health Tracker cannot start', String(e)); app.exit(1); });
  throw e;
}

const bundledVersion = dev ? 'dev' : readManifest(bundledRoot)?.version ?? 'unknown';

/** The application code calls this if it cannot start. An updated version gets rolled back on the next launch; the bundled one reports the error. */
function failStartup(err: unknown): void {
  console.error('[shell] startup failed', err);
  if (!dev && active.root !== bundledRoot) {
    try {
      const st = loadState(layout, bundledVersion);
      const pending = st.pending
        ? { ...st.pending, attempts: Math.max(1, st.pending.attempts) } // next launch rolls back
        : { version: active.version, from: st.previous, attempts: 1, schemaChanged: false, snapshot: null, startedAt: new Date().toISOString() };
      saveState(layout, { ...st, pending });
    } catch { /* relaunch anyway */ }
    app.relaunch();
    app.exit(1);
  } else {
    dialog.showErrorBox('Health Tracker cannot start', String(err instanceof Error ? err.stack || err.message : err));
    app.exit(1);
  }
}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const main = require(path.join(active.root, 'main.js')) as { start(ctx: unknown): void };
  main.start({ layout, bundledRoot, activeRoot: active.root, version: active.version, bundledVersion, dev, shellVersion: SHELL_VERSION, failStartup });
} catch (e) {
  app.whenReady().then(() => failStartup(e));
}
