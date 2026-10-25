import {DurableObject} from 'cloudflare:workers';
import {createSqliteStore} from './sqlite-store.js';
import {handleRequest} from './fetch-adapter.js';
import {sha256,safeEqual,newToken} from '../../server/src/store-core.js';

/** One serialized registry preserves budget, approval and hash-chain ordering. */
export class Registry extends DurableObject {
  constructor(ctx,env) {super(ctx,env);this.queue=Promise.resolve();}
  fetch(request) {
    const response = this.queue.then(()=>this.handle(request));
    this.queue=response.catch(()=>{});
    return response;
  }
  async handle(request) {
    const path=new URL(request.url).pathname;
    if (path==='/api/setup'||path==='/api/owner/recover')return Response.json({error:'Hosted registry is provisioned by its operator.'},{status:403});
    try {
      const store=this.store??=createSqliteStore(this.ctx.storage,{ownerHash:this.env.OWNER_KEY_HASH,ownerName:this.env.OWNER_NAME});
      if(path==='/api/operator/recover') {
        const credential=/^Bearer (.+)$/i.exec(request.headers.get('authorization')||'')?.[1]||'';
        if(request.method!=='POST'||!safeEqual(sha256(credential),this.env.RECOVERY_KEY_HASH))return Response.json({error:'Operator recovery credential required'},{status:403});
        const key=newToken('mio');store.state.owner.keyHash=sha256(key);store.append(null,'owner.key.recovered',{method:'operator-recovery-key'});store.save();store.commit();await this.ctx.storage.sync();
        return Response.json({key,notice:'Previous owner key invalidated; store this key securely.'});
      }
      const response=await handleRequest(request,store,{root:'/path/to/KYA',publicUrl:this.env.PUBLIC_URL});
      if(response.ok){store.commit();await this.ctx.storage.sync();}else this.store=null;
      return response;
    } catch(e){this.store=null;console.error('Registry request failed:',e.message);return Response.json({error:'Registry temporarily unavailable; no successful decision was returned.'},{status:503});}
  }
}

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname!='/health'&&!url.pathname.startsWith('/api/'))return Response.json({error:'Not found'},{status:404});
    const origin=request.headers.get('origin');
    const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
    // Vercel's same-origin proxy supports the site's custom domains. This only
    // controls browser CORS; every protected API route still checks its Bearer key.
    const viaFrontend=origin&&request.headers.has('x-vercel-id')&&request.headers.get('x-forwarded-host')===new URL(origin).host;
    if(origin&&!allowed.includes(origin)&&!viaFrontend)return Response.json({error:'Origin not allowed'},{status:403});
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{
      'Access-Control-Allow-Origin':origin||'*','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS',
      'Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'}});
    const id=env.REGISTRY.idFromName('wardrail-production');
    const response=await env.REGISTRY.get(id).fetch(request);
    const headers=new Headers(response.headers);
    headers.set('Cache-Control','no-store');headers.set('X-Content-Type-Options','nosniff');
    if(origin){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');}
    return new Response(response.body,{status:response.status,headers});
  },
};
