import {CopyButton, Code} from '../components/ui.jsx';
import {useConsole} from './ctx.js';
import {X} from 'lucide-react';

export default function KeyReveal({agent, secret, onClose, rotated}) {
  const url = location.origin;
  const mcp = useConsole().data.paths.mcp;
  return (
    <div className="modal-back">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Agent key">
        <div className="modal-head"><h2>{rotated ? 'New key for ' : ''}{agent.name}</h2><button className="icon-btn" onClick={onClose} aria-label="Done"><X size={17} /></button></div>
        <p className="muted">This key lets the agent ask for permission as <b>{agent.name}</b>. It is shown once and stored only as a hash.</p>
        <div className="secret"><code>{secret}</code><CopyButton text={secret} /></div>
        <p className="label">Fastest way to use it: wrap any MCP server</p>
        <Code title="shell" plain>{`SIGILANT_AGENT_KEY=${secret} SIGILANT_URL=${url} \\
  node ${mcp} -- npx @modelcontextprotocol/server-filesystem ~/project`}</Code>
        <div className="modal-foot"><button className="btn" onClick={onClose}>I saved the key</button></div>
      </div>
    </div>
  );
}
