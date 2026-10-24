import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {gzipSync, brotliCompressSync} from 'node:zlib';
import {createApp} from '../src/app.js';
import {createStore} from '../src/store.js';

test('static delivery: negotiated compression, HEAD, caching and traversal boundary', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'wardrail-static-'));
  const web = join(dir, 'web');
  await mkdir(join(web, 'assets'), {recursive: true});
  const content = 'console.log("Wardrail");';
  await writeFile(join(web, 'index.html'), '<h1>Wardrail</h1>');
  await writeFile(join(web, 'assets/app-123.js'), content);
  await writeFile(join(web, 'assets/app-123.js.gz'), gzipSync(content));
  await writeFile(join(web, 'assets/app-123.js.br'), brotliCompressSync(content));
  await mkdir(join(dir, 'web-private')); await writeFile(join(dir, 'web-private/secret.txt'), 'private');
  const server = createApp(createStore(join(dir, 'data')), {webDist: web});
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const encoding of ['br', 'gzip']) {
      const response = await fetch(url + '/assets/app-123.js', {headers: {'accept-encoding': encoding}});
      assert.equal(response.headers.get('content-encoding'), encoding);
      assert.match(response.headers.get('cache-control'), /immutable/);
      assert.equal(response.headers.get('vary'), 'Accept-Encoding');
      assert.match(response.headers.get('content-type'), /javascript/);
      assert.equal(await response.text(), content);
    }
    const plain = await fetch(url + '/assets/app-123.js', {headers: {'accept-encoding': 'br;q=0,gzip;q=0'}});
    assert.equal(plain.headers.get('content-encoding'), null); assert.equal(await plain.text(), content);
    const head = await fetch(url + '/assets/app-123.js', {method: 'HEAD', headers: {'accept-encoding': 'br'}});
    assert.equal(head.headers.get('content-encoding'), 'br'); assert.equal(await head.text(), '');
    const app = await fetch(url + '/app/agents');
    assert.equal(app.headers.get('cache-control'), 'no-cache');
    assert.match(app.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(await app.text(), '<h1>Wardrail</h1>');
    const home = await fetch(url + '/'); assert.equal(home.status, 200); assert.equal(await home.text(), '<h1>Wardrail</h1>');
    const traversal = await fetch(url + '/..%2fweb-private%2fsecret.txt'); assert.equal(traversal.status, 404);
    const missing = await fetch(url + '/assets/missing.js'); assert.equal(missing.status, 404);
  } finally {
    await new Promise(r => server.close(r));
    await rm(dir, {recursive: true, force: true});
  }
});
