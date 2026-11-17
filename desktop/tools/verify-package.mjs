import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as asar from '@electron/asar';
const archive = path.join('artifacts', 'win-unpacked', 'resources', 'app.asar');
const names = asar.listPackage(archive);
if (names.some(n => /private\.pem$|\.db(?:-wal|-shm)?$|smoke\.cjs$|release-notes|\.env$/i.test(n))) throw Error('Unexpected private or development file in packaged app');
const pkg = JSON.parse(asar.extractFile(archive, 'package.json'));
if (pkg.version !== '2.0.5' || pkg.name !== 'health-tracker' || pkg.productName !== 'Health Tracker' || pkg.main !== 'dist-shell/shell.js') throw Error('Packaged identity changed');
const manifest = JSON.parse(asar.extractFile(archive, 'dist-app/manifest.json'));
for (const f of manifest.files) {
  const b = asar.extractFile(archive, `dist-app/${f.path}`);
  if (b.length !== f.size || crypto.createHash('sha256').update(b).digest('hex') !== f.sha256) throw Error(`Packaged payload mismatch: ${f.path}`);
}
const native = path.join('artifacts', 'win-unpacked', 'resources', 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
if (!fs.existsSync(native)) throw Error('Unpacked native SQLite module missing');
const installer = 'artifacts/Health-Tracker-Setup-2.0.5.exe';
if (!fs.existsSync(installer) || fs.statSync(installer).size < 1000000) throw Error('Installer was not produced');
console.log('Packaged identity, payload hashes, file exclusions and native SQLite module verified.');
