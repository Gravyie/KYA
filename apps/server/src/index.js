import {existsSync, renameSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStore} from './store.js';
import {createApp} from './app.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const dataDir = process.env.SIGILANT_DATA_DIR || resolve(root, '.data/sigilant');
// Earlier builds stored data under the working names Veyscope and Auctent.
for (const old of ['auctent', 'veyscope']) {
  const dir = resolve(root, '.data', old);
  if (!process.env.SIGILANT_DATA_DIR && !existsSync(dataDir) && existsSync(dir)) renameSync(dir, dataDir);
}
const port = Number(process.env.PORT || 5055);
const host = process.env.SIGILANT_HOST || '127.0.0.1';

const store = createStore(dataDir);
createApp(store, {webDist: resolve(root, 'apps/web/dist'), root}).listen(port, host, () => {
  console.log(`Sigilant  http://${host}:${port}   data: ${dataDir}`);
});
