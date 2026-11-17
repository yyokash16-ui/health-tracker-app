const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const started = performance.now();
const data = process.env.HT_SMOKE_DATA;
if (!data || !path.basename(data).startsWith('ht-installer-smoke-')) throw Error('Isolated smoke directory required');
app.setName('Health Tracker');
app.setPath('userData', data);
fs.mkdirSync(path.join(data, 'downloads'), {recursive:true});
app.setPath('downloads', path.join(data, 'downloads'));
const Database = require('better-sqlite3');
if (process.env.HT_SMOKE_SCENARIO === 'existing') {
  const db = new Database(path.join(data, 'app.db'));
  db.exec("CREATE TABLE deployment_sentinel (value TEXT); INSERT INTO deployment_sentinel VALUES ('preserved')");
  db.close();
  const updates = path.join(data, 'Updates');
  fs.mkdirSync(path.join(updates, 'versions'), {recursive:true});
  fs.cpSync(path.join(__dirname, 'dist-app'), path.join(updates, 'versions', '2.0.5'), {recursive:true});
  fs.writeFileSync(path.join(updates, 'state.json'), JSON.stringify({format:1,bundledVersion:'2.0.0',current:'2.0.5',previous:'2.0.4',pending:null}));
}
const fail = error => { console.error(error); app.exit(1); };
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);
const deadline = setTimeout(() => fail(Error('App did not become ready in 45 seconds')), 45000);
let shownMs;
app.on('browser-window-created', (_event, win) => {
  win.once('show', () => { shownMs = performance.now() - started; });
  win.webContents.once('did-finish-load', async () => {
    try {
      const result = await win.webContents.executeJavaScript(`(async () => {
        const info = await window.desktop.invoke('app:info');
        const status = await window.desktop.invoke('update:status');
        await window.desktop.invoke('app:ready');
        return {info, status, text:document.body.innerText};
      })()`);
      if (result.status.version !== '2.0.5' || result.status.schemaVersion !== 3 || !result.text.includes('Today')) throw Error('Unexpected dashboard or update status');
      if (path.resolve(result.info.userData) !== path.resolve(data)) throw Error('Incorrect data directory');
      if (!result.status.onlineUrl.includes('yyokash16-ui/health-tracker-app/main/updates/latest.htupdate')) throw Error('Updater destination changed');
      const db = new Database(path.join(data, 'app.db'), {readonly:true});
      const schema = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get().version;
      const sentinelPreserved = process.env.HT_SMOKE_SCENARIO !== 'existing' || db.prepare('SELECT value FROM deployment_sentinel').get().value === 'preserved';
      db.close();
      if (schema !== 3 || !sentinelPreserved) throw Error('Data preservation or schema check failed');
      clearTimeout(deadline);
      const report = {scenario:process.env.HT_SMOKE_SCENARIO,version:result.status.version,schema,dataPreserved:sentinelPreserved,updaterUrl:result.status.onlineUrl,shownMs,readyMs:performance.now()-started};
      fs.writeFileSync(path.join(data,'result.json'),JSON.stringify(report,null,2));
      console.log(JSON.stringify(report));
      app.quit();
    } catch (error) { fail(error); }
  });
});
require('./dist-shell/shell.js');
