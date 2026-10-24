import {Readable} from 'node:stream';
import {createHandler} from '../../server/src/app.js';

/** Reuse the tested API routes; static files continue to be served by Vercel. */
export async function handleRequest(request, store, options = {}) {
  const length = Number(request.headers.get('content-length'));
  if (length > 65536) return Response.json({error: 'Body too large'}, {status: 413});
  const chunks = []; let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) { await reader.cancel(); return Response.json({error: 'Body too large'}, {status: 413}); }
      chunks.push(Buffer.from(value));
    }
  }
  const url = new URL(request.url), req = Readable.from(chunks);
  Object.assign(req, {method: request.method, url: url.pathname + url.search,
    headers: {...Object.fromEntries(request.headers), host: url.host, 'x-forwarded-proto': url.protocol.slice(0,-1)},
    socket: {remoteAddress: request.headers.get('cf-connecting-ip') || 'remote'}});
  let status = 200, headers = {}, body = '';
  const res = {writeHead(code, values) {status = code; headers = values;}, end(value = '') {body = value;}, destroy() {throw new Error('Response aborted');}};
  await createHandler(store, options)(req, res);
  return new Response(body || null, {status, headers});
}
