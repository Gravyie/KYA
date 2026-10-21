import {createServer} from 'node:http';
import {randomBytes, randomUUID, createHash, generateKeyPairSync, sign, verify, timingSafeEqual} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync, renameSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const legacyDataDir = resolve(root, '.data/veyscope');
const currentDataDir = resolve(root, '.data/auctent');
if (!process.env.AUCTENT_DATA_DIR && !existsSync(currentDataDir) && existsSync(legacyDataDir)) {
  renameSync(legacyDataDir, currentDataDir);
}
const dataDir = process.env.AUCTENT_DATA_DIR || currentDataDir;
const dataFile = resolve(dataDir, 'state.json');
const recoveryFile = resolve(dataDir, 'recovery.key');
const webDist = resolve(root, 'apps/web/dist');
const port = Number(process.env.PORT || 5055);
const host = process.env.AUCTENT_HOST || '127.0.0.1';
mkdirSync(dataDir, {recursive: true});
const hash = value => createHash('sha256').update(value).digest('hex');
const token = prefix => `${prefix}_${randomBytes(32).toString('base64url')}`;
if (!existsSync(recoveryFile)) writeFileSync(recoveryFile, token('aur')+'\n', {mode:0o600,flag:'wx'});
const recoveryHash = hash(readFileSync(recoveryFile, 'utf8').trim());
const now = () => new Date().toISOString();
const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
const initial = () => {
  const {privateKey, publicKey} = generateKeyPairSync('ed25519');
  return {version: 1, owner: null, agents: [], events: [], privateKey: privateKey.export({type:'pkcs8',format:'pem'}), publicKey: publicKey.export({type:'spki',format:'pem'})};
};
let state = existsSync(dataFile) ? JSON.parse(readFileSync(dataFile, 'utf8')) : initial();
function save() {
  const temp = `${dataFile}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(state, null, 2), {mode: 0o600});
  renameSync(temp, dataFile);
}
if (!existsSync(dataFile)) save();
const safeAgent = a => ({id:a.id, name:a.name, description:a.description, createdAt:a.createdAt, revokedAt:a.revokedAt, scopes:a.scopes, lastUsedAt:a.lastUsedAt, keyHint:a.keyHint});
function signature(payload) { return sign(null, Buffer.from(JSON.stringify(payload)), state.privateKey).toString('base64url'); }
function append(agentId, kind, details) {
  const previousHash = state.events.at(-1)?.hash || '0'.repeat(64);
  const entry = {id:randomUUID(), at:now(), agentId, kind, details, previousHash};
  entry.hash = hash(JSON.stringify(entry));
  state.events.push(entry);
  save();
  return entry;
}
function secureMatch(candidate, actual) {
  if (!candidate || !actual) return false;
  const a=Buffer.from(candidate), b=Buffer.from(actual);
  return a.length===b.length && timingSafeEqual(a,b);
}
function bearer(req) { return /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1] || ''; }
function owner(req) {
  if (!state.owner) fail(403, 'Set up an owner first');
  if (!secureMatch(hash(bearer(req)), state.owner.keyHash)) fail(401, 'Owner key required');
}
function agentAuth(req) {
  const supplied=hash(bearer(req));
  const agent=state.agents.find(a => secureMatch(supplied,a.keyHash));
  if (!agent) fail(401, 'Valid agent key required');
  return agent;
}
function body(req) { return new Promise((resolveBody,reject) => {
  const chunks=[]; let length=0;
  req.on('data', c => {length+=c.length; if(length>65536) {reject(Object.assign(new Error('Body too large'),{status:413})); req.destroy();} else chunks.push(c);});
  req.on('end',()=> {try {resolveBody(chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{});} catch {reject(Object.assign(new Error('Invalid JSON'),{status:400}));}});
  req.on('error',reject);
});}
function cleanScopes(scopes) {
  if (!Array.isArray(scopes) || !scopes.length || scopes.length>20) fail(400,'Add 1 to 20 scopes');
  return scopes.map(s => {
    const action=String(s.action||'').trim();
    if (!/^[a-z][a-z0-9_.:-]{1,79}$/.test(action)) fail(400,'Scope action must be a named tool, for example files.read');
    const resources=Array.isArray(s.resources)?s.resources.map(v=>String(v).trim()):[];
    if (!resources.length || resources.length>20 || resources.some(v=>!v || v.length>200)) fail(400,'Each scope needs 1 to 20 resources');
    const maxAmount=s.maxAmount==null || s.maxAmount===''?null:Number(s.maxAmount);
    if (maxAmount!==null && (!Number.isFinite(maxAmount)||maxAmount<0)) fail(400,'Maximum amount must be nonnegative');
    return {action, resources, maxAmount};
  });
}
function matches(pattern, resource) { return pattern==='*' || pattern===resource || (pattern.endsWith('/*') && resource.startsWith(pattern.slice(0,-1))); }
function decide(agent, request) {
  if (agent.revokedAt) return {allowed:false, reason:'Agent revoked'};
  const action=String(request.action||''); const resource=String(request.resource||'');
  const amount=request.amount==null?0:Number(request.amount);
  if (!action || !resource || action.length>80 || resource.length>300 || !Number.isFinite(amount) || amount<0) fail(400,'Provide action, resource, and a nonnegative amount');
  const scope=agent.scopes.find(s=>s.action===action && s.resources.some(r=>matches(r,resource)) && (s.maxAmount===null || amount<=s.maxAmount));
  return scope?{allowed:true,reason:'Within an active scope',scope}:{allowed:false,reason:'No active scope covers this action, resource and amount'};
}
const routes=[]; const route=(method,pattern,fn)=>routes.push({method,pattern,fn});
function staticFile(path,res,head=false) {
  const requested=path==='/'?'/index.html':path;
  const file=resolve(webDist,'.'+requested);
  if(!file.startsWith(webDist+'/')||!existsSync(file)) return false;
  const type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.woff2')?'font/woff2':file.endsWith('.woff')?'font/woff':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'application/octet-stream';
  res.writeHead(200,{'content-type':type,'x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'"});
  res.end(head?undefined:readFileSync(file));return true;
}
route('GET',/^\/health$/,()=>({ok:true,product:'Auctent',storage:'local'}));
route('GET',/^\/api\/registry$/,()=>({algorithm:'Ed25519',publicKey:state.publicKey,fingerprint:hash(state.publicKey)}));
route('GET',/^\/api\/status$/,()=>({configured:!!state.owner,owner:state.owner?.name||null,agentCount:state.agents.length,eventCount:state.events.length}));
route('POST',/^\/api\/preview$/,(_req,b)=>{
  const agent={revokedAt:null,scopes:cleanScopes(b.scopes)};
  return {decision:decide(agent,b.request||{}),preview:true};
});
route('POST',/^\/api\/setup$/,(_req,b)=>{
  if(state.owner) fail(409,'Owner already configured');
  const name=String(b.name||'').trim(); if(name.length<2||name.length>80) fail(400,'Owner name must be 2 to 80 characters');
  const key=token('auo'); state.owner={name,keyHash:hash(key),createdAt:now()}; append(null,'owner.created',{name});
  return {owner:{name},key,notice:'Save this key. It is shown once and cannot be recovered.'};
});
route('POST',/^\/api\/owner\/recover$/,(req)=>{
  if (!state.owner) fail(409,'Set up an owner first');
  if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) fail(403,'Local recovery only');
  if (!secureMatch(hash(bearer(req)),recoveryHash)) fail(401,'Local recovery credential required');
  const key=token('auo');
  state.owner.keyHash=hash(key);
  append(null,'owner.key.recovered',{method:'local-terminal'});
  return {key,notice:'The previous owner key is invalid. Save this new key now.'};
});
route('GET',/^\/api\/dashboard$/,(req)=>{owner(req);return {owner:state.owner.name,agents:state.agents.map(safeAgent),events:state.events.slice(-150).reverse()};});
route('POST',/^\/api\/agents$/,(req,b)=>{
  owner(req); const name=String(b.name||'').trim(); if(name.length<2||name.length>80) fail(400,'Agent name must be 2 to 80 characters');
  const scopes=cleanScopes(b.scopes); const key=token('aua');
  const agent={id:randomUUID(),name,description:String(b.description||'').slice(0,240),createdAt:now(),revokedAt:null,scopes,keyHash:hash(key),keyHint:key.slice(-6),lastUsedAt:null};
  state.agents.push(agent); append(agent.id,'agent.created',{name,scopes});
  return {agent:safeAgent(agent),key,notice:'Save this key. It is shown once.'};
});
route('PUT',/^\/api\/agents\/([^/]+)\/scopes$/,(req,b,[id])=>{
  owner(req);const a=state.agents.find(x=>x.id===id);if(!a)fail(404,'Agent not found');if(a.revokedAt)fail(409,'Agent revoked');
  a.scopes=cleanScopes(b.scopes);append(id,'agent.scopes.updated',{scopes:a.scopes});return {agent:safeAgent(a)};
});
route('POST',/^\/api\/agents\/([^/]+)\/simulate$/,(req,b,[id])=>{
  owner(req);const a=state.agents.find(x=>x.id===id);if(!a)fail(404,'Agent not found');
  return {agentId:id,decision:decide(a,b),preview:true};
});
route('POST',/^\/api\/agents\/([^/]+)\/rotate$/,(req,_b,[id])=>{
  owner(req);const a=state.agents.find(x=>x.id===id);if(!a)fail(404,'Agent not found');if(a.revokedAt)fail(409,'Agent revoked');
  const key=token('aua');a.keyHash=hash(key);a.keyHint=key.slice(-6);append(id,'agent.key.rotated',{});return {agent:safeAgent(a),key};
});
route('POST',/^\/api\/agents\/([^/]+)\/revoke$/,(req,_b,[id])=>{
  owner(req);const a=state.agents.find(x=>x.id===id);if(!a)fail(404,'Agent not found');if(!a.revokedAt){a.revokedAt=now();append(id,'agent.revoked',{});}return {agent:safeAgent(a)};
});
route('GET',/^\/api\/agents\/([^/]+)\/card$/,(_req,_b,[id])=>{
  const a=state.agents.find(x=>x.id===id);if(!a)fail(404,'Agent not found');
  const card={issuer:'Auctent local registry',id:a.id,name:a.name,description:a.description,createdAt:a.createdAt,revokedAt:a.revokedAt,scopes:a.scopes};
  return {card,signature:signature(card),algorithm:'Ed25519',publicKey:state.publicKey};
});
route('GET',/^\/api\/agents\/([^/]+)\/status$/,(_req,_b,[id])=>{
  const a=state.agents.find(x=>x.id===id);if(!a)fail(404,'Agent not found');return {id,active:!a.revokedAt,revokedAt:a.revokedAt};
});
route('POST',/^\/api\/authorize$/,(req,b)=>{
  const a=agentAuth(req);const decision=decide(a,b);a.lastUsedAt=now();
  const entry=append(a.id,decision.allowed?'action.allowed':'action.denied',{action:b.action,resource:b.resource,amount:b.amount??0,reason:decision.reason});
  return {agentId:a.id,decision:{allowed:decision.allowed,reason:decision.reason},eventId:entry.id};
});
route('POST',/^\/api\/receipt$/,(req,b)=>{
  const a=agentAuth(req);const prior=state.events.find(e=>e.id===b.eventId && e.agentId===a.id && e.kind==='action.allowed');
  if(!prior)fail(403,'Receipt requires an allowed decision for this agent');
  if(state.events.some(e=>e.kind==='action.reported'&&e.details.eventId===b.eventId))fail(409,'Receipt already submitted');
  const outcome=b.outcome==='success'?'success':b.outcome==='failure'?'failure':null;if(!outcome)fail(400,'Outcome must be success or failure');
  const entry=append(a.id,'action.reported',{eventId:b.eventId,outcome,note:String(b.note||'').slice(0,500),source:'agent-reported'});
  return {event:entry};
});
route('GET',/^\/api\/audit\/verify$/,(req)=>{
  owner(req);let previous='0'.repeat(64);
  for(const e of state.events){const {hash:recorded,...unsigned}=e;if(e.previousHash!==previous||hash(JSON.stringify(unsigned))!==recorded)return {valid:false,at:e.id};previous=recorded;}
  return {valid:true,count:state.events.length,head:previous};
});
route('GET',/^\/api\/audit\/export$/,(req)=>{
  owner(req);
  return {format:'auctent-audit-v1',exportedAt:now(),publicKey:state.publicKey,count:state.events.length,head:state.events.at(-1)?.hash||'0'.repeat(64),events:state.events};
});
createServer(async(req,res)=>{
  const send=(status,obj)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(obj));};
  try {const path=new URL(req.url,'http://localhost').pathname;const match=routes.find(r=>r.method===req.method&&r.pattern.test(path));if(!match){if(['GET','HEAD'].includes(req.method)&&!path.startsWith('/api/')&&staticFile(path,res,req.method==='HEAD'))return;return send(404,{error:'Not found'});}
    const b=['POST','PUT','PATCH'].includes(req.method)?await body(req):{};const result=await match.fn(req,b,match.pattern.exec(path)?.slice(1)||[]);send(200,result);
  } catch(e){send(e.status||500,{error:e.status?e.message:'Internal error'});if(!e.status)console.error(e);}
}).listen(port,host,()=>console.log(`Auctent API http://${host}:${port}`));
