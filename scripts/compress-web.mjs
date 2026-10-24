import {readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {promisify} from 'node:util';
import {brotliCompress, gzip, constants} from 'node:zlib';
const brotli = promisify(brotliCompress), gz = promisify(gzip);
const root = resolve(import.meta.dirname, '../apps/web/dist');
let files = 0;
for (const entry of await readdir(root, {recursive: true, withFileTypes: true})) {
  if (!entry.isFile() || !['.js', '.css', '.html', '.svg', '.txt', '.json'].includes(extname(entry.name))) continue;
  const path = resolve(entry.parentPath, entry.name), source = await readFile(path);
  if (source.length < 1024) continue;
  const [br, gzipData] = await Promise.all([brotli(source, {params: {[constants.BROTLI_PARAM_QUALITY]: 9}}), gz(source, {level: 9})]);
  await Promise.all([writeFile(path + '.br', br), writeFile(path + '.gz', gzipData)]); files++;
}
console.log(`Prepared Brotli and gzip variants for ${files} web assets.`);
