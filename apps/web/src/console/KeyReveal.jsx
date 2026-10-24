import {CopyButton, Code} from '../components/ui.jsx';
import {useConsole} from './ctx.js';
import {useDialog} from '../lib/useDialog.js';

export default function KeyReveal({agent, secret, onClose, rotated}) {
  const url = location.origin;
  const dialogRef = useDialog(); // A secret must be deliberately acknowledged, never dismissed by Escape.
  const mcp = useConsole().data.paths.mcp;
  return (
    <div className="modal-back">
      <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label="Agent key">
        <div className="modal-head"><h2>{rotated ? 'New key for ' : ''}{agent.name}</h2></div>
        <p className="muted">This key lets the agent ask for permission as <b>{agent.name}</b>. It is shown once and stored only as a hash.</p>
        <div className="secret"><code>{secret}</code><CopyButton text={secret} /></div>
        <p className="label">Fastest way to use it: wrap any MCP server</p>
        <Code title="shell" plain>{`MIHARI_AGENT_KEY=${secret} MIHARI_URL=${url} \\
  node ${mcp} -- npx @modelcontextprotocol/server-filesystem ~/project`}</Code>
        <div className="modal-foot"><button className="btn" onClick={onClose}>I saved the key</button></div>
      </div>
    </div>
  );
}
