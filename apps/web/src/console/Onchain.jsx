import {useEffect, useState} from 'react';
import {ExternalLink, Link2, Wallet} from 'lucide-react';
import {api} from '../lib/api.js';
import {hasWallet, connect, switchChain, registerAgent, updateUri} from '../lib/wallet.js';
import {Badge, Code, CopyButton} from '../components/ui.jsx';
import {agentRegistryId} from '../../../../packages/sdk/src/erc8004.js';
import {useConsole} from './ctx.js';

const short = a => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default function Onchain({agent}) {
  const {refresh, notify} = useConsole();
  const [info, setInfo] = useState(null);
  const [chainId, setChainId] = useState(84532);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  useEffect(() => { api.erc8004(agent.id).then(setInfo).catch(e => setError(e.message)); }, [agent.id, agent.onchain?.agentId, agent.scopes]);

  if (!info) return <section className="panel"><div className="panel-head"><h2>On-chain identity</h2></div><p className="muted">{error || 'Loading…'}</p></section>;
  const chain = info.chains.find(c => c.id === Number(chainId));
  const linked = agent.onchain;
  const linkedChain = linked && info.chains.find(c => c.id === linked.chainId);

  async function run(label, fn) {
    setBusy(label); setError('');
    try { await fn(); await refresh(); } catch (e) { setError(e.shortMessage || e.message || String(e)); } finally { setBusy(''); }
  }
  const register = () => run('register', async () => {
    const from = await connect();
    await switchChain(chain);
    notify('Confirm the transaction in your wallet');
    const {agentId, txHash} = await registerAgent({from, chain, agentURI: info.agentURI, onSubmitted: () => notify('Submitted. Waiting for confirmation…')});
    await api.linkOnchain(agent.id, {chainId: chain.id, agentId, owner: from, txHash});
    notify(`Registered as agent #${agentId} on ${chain.name}`);
  });
  const sync = () => run('sync', async () => {
    const from = await connect(); await switchChain(linkedChain);
    const fresh = await api.erc8004(agent.id);
    await updateUri({from, chain: linkedChain, agentId: linked.agentId, agentURI: fresh.agentURI});
    notify('On-chain URI updated');
  });
  const linkManual = e => { e.preventDefault(); run('link', async () => { await api.linkOnchain(agent.id, {chainId: chain.id, agentId: manual.trim()}); notify('Linked and verified on-chain'); setManual(''); }); };

  const cast = `cast send ${chain.registry} "register(string)" \\
  "${info.agentURI.slice(0, 48)}…" \\
  --rpc-url ${chain.rpc} --private-key $PRIVATE_KEY`;
  const castFull = `cast send ${chain.registry} "register(string)" "${info.agentURI}" --rpc-url ${chain.rpc} --private-key $PRIVATE_KEY`;

  return (
    <section className="panel onchain">
      <div className="panel-head"><h2>On-chain identity <span className="hint">ERC-8004</span></h2>{linked ? <Badge tone="allow">Registered</Badge> : <Badge plain>Off-chain only</Badge>}</div>
      <p className="muted pad-b">Publish this agent’s passport to the public ERC-8004 Identity Registry so any service can discover and check it without trusting this server. The registration file travels inside the transaction itself, so there is nothing to host.</p>

      {linked ? (
        <>
          <dl className="facts-grid">
            <dt>Network</dt><dd>{linkedChain?.name} {linkedChain?.testnet && <Badge plain>testnet</Badge>}</dd>
            <dt>Agent ID</dt><dd className="mono">#{linked.agentId}</dd>
            <dt>Registry</dt><dd className="mono wrap-all">{agentRegistryId(linked.chainId, linked.registry)} <CopyButton text={agentRegistryId(linked.chainId, linked.registry)} /></dd>
            <dt>Owner wallet</dt><dd className="mono">{linked.owner}</dd>
            <dt>Binding</dt><dd>{linked.uriBound ? 'On-chain file names this Mihari agent ✓' : 'Linked by ID; the on-chain URI is not a Mihari file'}</dd>
            {linked.txHash && <><dt>Transaction</dt><dd className="mono wrap-all"><a href={`${linkedChain.explorer}/tx/${linked.txHash}`} target="_blank" rel="noreferrer">{short(linked.txHash)} <ExternalLink size={12} /></a></dd></>}
          </dl>
          <div className="actions mt">
            <a className="btn ghost sm" href={`${linkedChain.explorer}/token/${linked.registry}?a=${linked.agentId}`} target="_blank" rel="noreferrer">View on explorer <ExternalLink size={13} /></a>
            {hasWallet() && <button className="btn ghost sm" disabled={!!busy} onClick={sync}>{busy === 'sync' ? 'Updating…' : 'Update on-chain file'}</button>}
          </div>
        </>
      ) : (
        <>
          <div className="oc-row">
            <label className="field"><span>Network</span>
              <select className="input" value={chainId} onChange={e => setChainId(e.target.value)}>
                {info.chains.map(c => <option key={c.id} value={c.id}>{c.name}{c.testnet ? ' (testnet, free)' : ' (real funds)'}</option>)}
              </select>
            </label>
            {hasWallet()
              ? <button className="btn" disabled={!!busy || agent.status === 'revoked'} onClick={register}><Wallet size={15} /> {busy === 'register' ? 'Waiting for wallet…' : 'Register with wallet'}</button>
              : <p className="hint oc-nowallet">No browser wallet found. Use the command below, then link the agent by its ID.</p>}
          </div>
          {chain.testnet && <p className="hint">Testnet gas is free from a faucet. {chain.name} registrations carry no value but are real and public.</p>}
          <details><summary>Register from the command line</summary>
            <Code title="foundry" plain>{cast}</Code>
            <p className="hint">Copy the full command: <CopyButton text={castFull} label="Copy full command" /></p>
          </details>
          <form className="oc-link" onSubmit={linkManual}>
            <label className="field"><span>Already registered? Link by agent ID</span>
              <div className="inline"><input className="input mono" inputMode="numeric" placeholder="e.g. 10353" value={manual} onChange={e => setManual(e.target.value)} /><button className="btn ghost" disabled={!manual.trim() || !!busy}><Link2 size={14} /> Verify &amp; link</button></div>
            </label>
          </form>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  );
}
