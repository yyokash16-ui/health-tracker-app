import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import JSZip from 'jszip';
import { build } from 'esbuild';

const sourceCommit = 'd5589acbf8d2d8b6dec9ac2b281079c895ab47a7';
const expectedBlob = '8018442bd379e3eddb17f5b01af2c22a282ecc36';
const url = `https://raw.githubusercontent.com/yyokash16-ui/health-tracker-app/${sourceCommit}/updates/latest.htupdate`;
const response = await fetch(url);
if (!response.ok) throw Error(`Download failed: ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const blob = crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
if (blob !== expectedBlob) throw Error('Update artifact does not match the audited Git blob');
const zip = await JSZip.loadAsync(bytes, { checkCRC32: true });
const manifestBytes = await zip.file('manifest.json').async('nodebuffer');
const signature = Buffer.from((await zip.file('manifest.sig').async('string')).trim(), 'base64');
if (!crypto.verify(null, manifestBytes, fs.readFileSync('public.pem'), signature)) throw Error('Update signature is invalid');
const manifest = JSON.parse(manifestBytes);
if (manifest.version !== '2.0.5' || manifest.appId !== 'com.local.healthtracker' || manifest.baseVersion !== null || manifest.schemaVersion !== 3 || manifest.minShellVersion > 1) throw Error('Unexpected update identity or compatibility');
const seen = new Set();
const verified = [];
for (const file of manifest.files) {
  if (!file.path || file.path.includes('\\') || file.path.includes(':') || file.path.split('/').some(p => !p || p === '.' || p === '..') || seen.has(file.path)) throw Error('Unsafe or duplicate manifest path');
  seen.add(file.path);
  const entry = zip.file(`payload/${file.path}`);
  if (!entry) throw Error(`Full update is missing ${file.path}`);
  const content = await entry.async('nodebuffer');
  if (content.length !== file.size || crypto.createHash('sha256').update(content).digest('hex') !== file.sha256) throw Error(`Integrity check failed: ${file.path}`);
  verified.push([file.path, content]);
}
if (!seen.has('main.js') || !seen.has('preload.js') || !seen.has('renderer/index.html')) throw Error('Required runtime files missing');
if (fs.existsSync('dist-app')) throw Error('Use a clean packaging directory; dist-app already exists');
for (const [name, content] of verified) {
  const target = path.join('dist-app', ...name.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
fs.writeFileSync('dist-app/manifest.json', manifestBytes);
fs.cpSync('node_modules/better-sqlite3', 'dist-app/node_modules/better-sqlite3', { recursive: true });
await build({ entryPoints: ['electron/shell.ts'], outfile: 'dist-shell/shell.js', platform: 'node', target: 'node22', format: 'cjs', bundle: true, external: ['electron'], sourcemap: false });
fs.mkdirSync('artifacts', { recursive: true });
fs.writeFileSync('artifacts/HealthTracker-2.0.5-full.htupdate', bytes);
fs.writeFileSync('artifacts/provenance.json', JSON.stringify({ version: manifest.version, sourceCommit, updateGitBlob: blob, updateSha256: crypto.createHash('sha256').update(bytes).digest('hex'), signatureVerified: true, payloadFilesVerified: verified.length, payloadUnmodified: true, shellProtocol: 1, dataDirectory: '%APPDATA%/Health Tracker', installer: 'NSIS x64', windowsAuthenticodeSigned: false }, null, 2));
console.log(`Verified signature and ${verified.length} payload files; packaged app remains v2.0.5.`);

