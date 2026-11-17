const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
for (const scenario of ['fresh', 'existing']) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'ht-installer-smoke-'));
  const run = spawnSync(require('electron'), [path.resolve('smoke.cjs')], { env: { ...process.env, HT_SMOKE_DATA: data, HT_SMOKE_SCENARIO: scenario }, encoding: 'utf8', timeout: 60000 });
  if (run.stdout) process.stdout.write(run.stdout);
  if (run.stderr) process.stderr.write(run.stderr);
  if (run.error || run.status !== 0) throw run.error || Error(`${scenario} smoke failed (${run.status})`);
  const result = JSON.parse(fs.readFileSync(path.join(data, 'result.json'), 'utf8'));
  fs.mkdirSync('artifacts', {recursive:true});
  fs.writeFileSync(`artifacts/smoke-${scenario}.json`, JSON.stringify(result, null, 2));
}
