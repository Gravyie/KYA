import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {createHash} from 'node:crypto';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import assert from 'node:assert/strict';
const key='mio_worker-smoke-private',dir=await mkdtemp(join(tmpdir(),'wardrail-worker-'));
const options={name:'wardrail-smoke',rootPath:dirname(resolve(process.env.WORKER_BUNDLE||'.worker-build/index.js')),modules:true,scriptPath:resolve(process.env.WORKER_BUNDLE||'.worker-build/index.js'),
 compatibilityDate:'2026-10-24',compatibilityFlags:['nodejs_compat'],
 durableObjects:{REGISTRY:{className:'Registry',useSQLite:true}},resourcePersistencePath:dir,
 bindings:{OWNER_KEY_HASH:createHash('sha256').update(key).digest('hex'),OWNER_NAME:'Smoke operator',ALLOWED_ORIGINS:'https://frontend.test',RECOVERY_KEY_HASH:createHash('sha256').update('mir_worker-recovery').digest('hex')}};
let mf=new Miniflare(convertV4MiniflareOptions(options));
async function api(path,body,token=key,method=body?'POST':'GET'){
 const r=await mf.dispatchFetch('https://worker.test'+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 return {status:r.status,body:await r.json()};
}
try {
 assert.equal((await api('/health')).body.storage,'cloudflare-sqlite');
 assert.equal((await api('/api/setup',{name:'Intruder'})).status,403);
 assert.equal((await api('/api/dashboard',null,'bad')).status,401);
 const created=await api('/api/agents',{name:'Production smoke agent',scopes:[{action:'files.read',resources:['workspace/*'],mode:'allow'},{action:'git.push',resources:['origin/*'],mode:'ask'}],limits:{rate:{count:1,windowMinutes:60}}});
 assert.equal(created.status,200);const agent=created.body;
 const race=await Promise.all(Array.from({length:8},()=>api('/api/authorize',{action:'files.read',resource:'workspace/report.md'},agent.key)));
 assert.equal(race.filter(r=>r.body.decision.allowed).length,1,'concurrent calls must not bypass rate limit');
 const identity=(await api('/api/registry')).body;
 const assertion=await api('/api/assertion',{audience:'smoke'},agent.key);assert.equal(assertion.status,200);
 assert.equal((await api('/api/verify',{token:assertion.body.token,audience:'smoke'})).body.valid,true);
 assert.equal((await api('/api/audit/verify')).body.valid,true);
 const before=(await api('/api/dashboard')).body;
 await mf.dispose();mf=new Miniflare(convertV4MiniflareOptions(options));
 assert.equal((await api('/api/registry')).body.fingerprint,identity.fingerprint,'signing identity survives restart');
 assert.equal((await api('/api/dashboard')).body.eventCount,before.eventCount,'events survive restart');
 assert.equal((await api('/api/audit/verify')).body.valid,true);
 assert.equal((await api('/api/agents/'+agent.agent.id+'/revoke',{})).status,200);
 assert.equal((await api('/api/authorize',{action:'files.read',resource:'workspace/report.md'},agent.key)).body.decision.outcome,'deny');
 const second=await api('/api/agents',{name:'Approval agent',scopes:[{action:'git.push',resources:['origin/*'],mode:'ask'}]});
 const pending=await api('/api/authorize',{action:'git.push',resource:'origin/main'},second.body.key);assert.equal(pending.body.decision.outcome,'ask');
 assert.equal((await api('/api/approvals/'+pending.body.approvalId+'/resolve',{approve:true})).status,200);
 assert.equal((await api('/api/authorize/'+pending.body.approvalId,null,second.body.key)).body.status,'approved');
 const recovered=await api('/api/operator/recover',{},'mir_worker-recovery');assert.equal(recovered.status,200);
 assert.equal((await api('/api/dashboard')).status,401);assert.equal((await api('/api/dashboard',null,recovered.body.key)).status,200);
 const evil=await mf.dispatchFetch('https://worker.test/api/status',{headers:{origin:'https://evil.test'}});assert.equal(evil.status,403);
 const proxy=await mf.dispatchFetch('https://worker.test/api/status',{headers:{origin:'https://custom.example','x-vercel-id':'proxy-test','x-forwarded-host':'custom.example'}});assert.equal(proxy.status,200);
 const protectedProxy=await mf.dispatchFetch('https://worker.test/api/dashboard',{headers:{origin:'https://custom.example','x-vercel-id':'proxy-test','x-forwarded-host':'custom.example'}});assert.equal(protectedProxy.status,401);
 const preflight=await mf.dispatchFetch('https://worker.test/api/status',{method:'OPTIONS',headers:{origin:'https://frontend.test'}});assert.equal(preflight.status,204);
 const large=await mf.dispatchFetch('https://worker.test/api/preview',{method:'POST',body:'x'.repeat(70000)});assert.equal(large.status,413);
 console.log('WORKER CHECKS PASSED: provisioned owner, authorization, concurrent rate limit, signed identity, audit, durable restart, revocation, CORS and size limits.');
}finally{await mf.dispose();await rm(dir,{recursive:true,force:true});}
