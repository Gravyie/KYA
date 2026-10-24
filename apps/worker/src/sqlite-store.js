import {generateKeyPairSync} from 'node:crypto';
import {createStoreCore, now} from '../../server/src/store-core.js';

/** A transaction commits state and every appended event together, before responding. */
export function createSqliteStore(storage, {ownerHash, ownerName = 'Wardrail workspace'}) {
  const sql = storage.sql;
  sql.exec('CREATE TABLE IF NOT EXISTS registry (id INTEGER PRIMARY KEY CHECK(id=1), body TEXT NOT NULL)');
  sql.exec('CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY, body TEXT NOT NULL)');
  let row = sql.exec('SELECT body FROM registry WHERE id=1').toArray()[0];
  if (!row) {
    if (!/^[a-f0-9]{64}$/.test(ownerHash || '')) throw new Error('Owner key hash must be provisioned before launch');
    const {privateKey, publicKey} = generateKeyPairSync('ed25519');
    const state = {version:2, owner:{name:ownerName,keyHash:ownerHash,createdAt:now()}, agents:[],approvals:[],
      privateKey:privateKey.export({type:'pkcs8',format:'pem'}),publicKey:publicKey.export({type:'spki',format:'pem'})};
    sql.exec('INSERT INTO registry(id,body) VALUES (1,?)',JSON.stringify(state));
    row = {body:JSON.stringify(state)};
  }
  const state = JSON.parse(row.body), events = sql.exec('SELECT body FROM events ORDER BY seq').toArray().map(r=>JSON.parse(r.body));
  let persistedCount = events.length;
  let dirty = false;
  const store = createStoreCore(state,events,{storage:'cloudflare-sqlite',save(){dirty=true;},
    writeEvent(){if(events.length>=10000)throw Object.assign(new Error('Registry event capacity reached. Export the audit log and contact the operator.'),{status:507});dirty=true;},
    recoveryHash:()=>''});
  store.commit = () => {
    if (!dirty) return;
    if (state.agents.length>100)throw new Error('Registry agent capacity reached');
    storage.transactionSync(()=>{
      sql.exec('UPDATE registry SET body=? WHERE id=1',JSON.stringify(state));
      for (const e of events.slice(persistedCount))sql.exec('INSERT INTO events(seq,body) VALUES (?,?)',e.seq,JSON.stringify(e));
    });
    persistedCount=events.length;dirty=false;
  };
  return store;
}
