import {existsSync, renameSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStore} from './store.js';
import {createApp} from './app.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const dataDir = process.env.MIHARI_DATA_DIR || resolve(root, '.data/mihari');
// Earlier builds stored data under the working names Veyscope, Auctent, Sigilant and Shuin.
for (const old of ['shuin', 'sigilant', 'auctent', 'veyscope']) {
  const dir = resolve(root, '.data', old);
  if (!process.env.MIHARI_DATA_DIR && !existsSync(dataDir) && existsSync(dir)) renameSync(dir, dataDir);
}
const port = Number(process.env.PORT || 5055);
const host = process.env.MIHARI_HOST || '127.0.0.1';

const store = createStore(dataDir);
const server = createApp(store, {webDist: resolve(root, 'apps/web/dist'), root}).listen(port, host, () => {
  console.log(`Wardrail  http://${host}:${port}   data: ${dataDir}`);
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
});
