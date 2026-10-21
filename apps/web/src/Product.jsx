import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-700.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/dm-mono/latin-400.css";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Fingerprint,
  ArrowRight,
  Plus,
  KeyRound,
  Copy,
  RotateCw,
  Terminal,
  Check,
  X,
  Download,
  Play,
  ArrowUpRight,
  LockKeyhole,
  Menu,
} from "lucide-react";
import "./product.css";
import "./product-heritage.css";
import "./cyber.css";

async function api(path, method = "GET", key = "", body) {
  const r = await fetch("/api" + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(key ? { authorization: "Bearer " + key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(d.error || "Request failed");
  return d;
}
function Logo() {
  return (
    <span className="logo">
      <strong>AUCTENT</strong>
      <span className="logo-caption">
        <i>//</i> KNOW YOUR AGENT
      </span>
    </span>
  );
}
function Button({ children, onClick, plain = false, type = "button" }) {
  return (
    <button
      className={plain ? "button plain" : "button"}
      type={type}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
function ScopeForm({ onSubmit, initial, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [scopes, setScopes] = useState(
    initial?.scopes || [
      { action: "files.read", resources: ["workspace/*"], maxAmount: null },
    ],
  );
  const set = (i, k, v) =>
    setScopes(scopes.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  return (
    <form
      className="agent-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          name,
          description,
          scopes: scopes.map((s) => ({
            ...s,
            resources: s.resources.map((x) => x.trim()).filter(Boolean),
            maxAmount: s.maxAmount === "" ? null : s.maxAmount,
          })),
        });
      }}
    >
      <div className="form-two">
        <label>
          Agent name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!!initial}
            required
            minLength={2}
            placeholder="Research assistant"
          />
        </label>
        <label>
          Description
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={!!initial}
            placeholder="Reads project files"
          />
        </label>
      </div>
      <h3>
        Permission scopes <small>Default deny</small>
      </h3>
      {scopes.map((s, i) => (
        <div className="scope-row" key={i}>
          <label>
            Tool action
            <input
              required
              value={s.action}
              onChange={(e) => set(i, "action", e.target.value)}
              placeholder="files.read"
            />
          </label>
          <label>
            Resources, one per line
            <input
              required
              value={s.resources.join(", ")}
              onChange={(e) =>
                set(
                  i,
                  "resources",
                  e.target.value.split(",").map((x) => x.trim()),
                )
              }
              placeholder="workspace/*"
            />
          </label>
          <label>
            Max amount
            <input
              type="number"
              min="0"
              value={s.maxAmount ?? ""}
              onChange={(e) => set(i, "maxAmount", e.target.value)}
              placeholder="None"
            />
          </label>
          <button
            type="button"
            onClick={() => setScopes(scopes.filter((_, j) => j !== i))}
            aria-label="Remove scope"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-action"
        onClick={() =>
          setScopes([
            ...scopes,
            { action: "", resources: ["*"], maxAmount: null },
          ])
        }
      >
        <Plus size={16} /> Add scope
      </button>
      <div className="form-actions">
        <Button type="submit">
          {initial ? "Save scopes" : "Create agent"} <ArrowRight size={17} />
        </Button>
        <Button plain onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
function Events({ items, agents, full, emptyMessage = "No events yet." }) {
  return (
    <div className="events">
      {items.length ? (
        items.map((e) => (
          <div className="event" key={e.id}>
            <span
              className={
                e.kind.includes("denied") || e.kind.includes("revoked")
                  ? "event-icon red"
                  : "event-icon"
              }
            >
              <Check size={16} />
            </span>
            <div>
              <strong>{e.kind.replaceAll(".", " ")}</strong>
              <p>
                {agents.find((a) => a.id === e.agentId)?.name || "Workspace"}
                {e.details.action
                  ? " · " + e.details.action + " → " + e.details.resource
                  : ""}
                {e.details.reason ? " · " + e.details.reason : ""}
              </p>
              {full && (
                <small>
                  HASH {e.hash}
                  <br />
                  PREVIOUS {e.previousHash}
                </small>
              )}
            </div>
            <time>{new Date(e.at).toLocaleString()}</time>
          </div>
        ))
      ) : (
        <div className="empty">{emptyMessage}</div>
      )}
    </div>
  );
}
const previewScopes = [
  { action: "files.read", resources: ["workspace/*"], maxAmount: 0 },
];
function PolicyLab() {
  const [request, setRequest] = useState({
    action: "files.read",
    resource: "workspace/report.md",
    amount: 0,
  });
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function preview(next = request) {
    setBusy(true);
    setError("");
    try {
      const result = await api("/preview", "POST", "", {
        scopes: previewScopes,
        request: next,
      });
      setDecision(result.decision);
    } catch (cause) {
      setDecision(null);
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => { preview(); }, []);
  return (
    <div className="policy-lab">
      <div className="lab-bar"><span><i /> LIVE POLICY LAB</span><span>LOCAL ENGINE / PREVIEW</span></div>
      <div className="lab-head">
        <span className="lab-glyph">↳</span>
        <div><small>THE BOUNDARY</small><strong>One rule. Every call checked.</strong></div>
      </div>
      <div className="lab-rule"><span>ALLOW</span><code>files.read</code><span>ON</span><code>workspace/*</code></div>
      <form className="lab-form" onSubmit={(event) => { event.preventDefault(); preview(); }}>
        <label>Requested action<input value={request.action} onChange={(event) => setRequest({...request, action: event.target.value})} required /></label>
        <label>Resource<input value={request.resource} onChange={(event) => setRequest({...request, resource: event.target.value})} required /></label>
        <button type="submit" disabled={busy}><Play size={15} fill="currentColor" /> {busy ? "Checking…" : "Run check"}</button>
      </form>
      <div className="lab-presets">
        <span>TRY</span>
        <button type="button" onClick={() => {const next={...request,action:"files.read",resource:"workspace/report.md"};setRequest(next);preview(next);}}>Allowed read ↗</button>
        <button type="button" onClick={() => {const next={...request,action:"files.write",resource:"workspace/report.md"};setRequest(next);preview(next);}}>Denied write ↗</button>
      </div>
      <div key={error || `${decision?.allowed}-${decision?.reason}`} className={`lab-result ${decision?.allowed ? "allowed" : "denied"}`} aria-live="polite">
        <span>{error ? "ERROR" : decision ? decision.allowed ? "✓ ALLOWED" : "× DENIED" : "CHECKING"}</span>
        <strong>{error || decision?.reason || "Asking the local policy engine…"}</strong>
      </div>
      <p className="lab-footnote">This preview runs the real policy engine. Agent calls require a key and enter the audit trail.</p>
    </div>
  );
}
function AgentPlayground({ agent, action }) {
  const first = agent.scopes[0];
  const [tool, setTool] = useState(first?.action || "files.read");
  const [resource, setResource] = useState(first?.resources[0]?.replace("*", "report.md") || "workspace/report.md");
  const [amount, setAmount] = useState("0");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="agent-playground">
      <div><span className="eyebrow">POLICY PREVIEW</span><p>Check an action against this agent’s current scopes. Previews do not add audit events.</p></div>
      <form onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setError("");
        try { setResult((await action(`/agents/${agent.id}/simulate`, "POST", {action:tool, resource, amount:Number(amount)})).decision); }
        catch (cause) {setResult(null);setError(cause.message);}
        finally {setBusy(false);}
      }}>
        <label>Action<input value={tool} onChange={(event) => setTool(event.target.value)} required /></label>
        <label>Resource<input value={resource} onChange={(event) => setResource(event.target.value)} required /></label>
        <label>Amount<input type="number" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
        <button type="submit" disabled={busy}><Play size={15} /> {busy ? "Checking" : "Test"}</button>
      </form>
      {(result || error) && <p className={`playground-result ${result?.allowed ? "allowed" : "denied"}`} role="status">{error || `${result.allowed ? "ALLOWED" : "DENIED"} · ${result.reason}`}</p>}
    </div>
  );
}
export default function Product() {
  const reducedMotion = useReducedMotion();
  const [page, setPage] = useState(location.hash.slice(1) || "home");
  const [status, setStatus] = useState(null);
  const [apiOnline, setApiOnline] = useState(null);
  const [registry, setRegistry] = useState(null);
  const [key, setKey] = useState(() => {
    const current = localStorage.getItem("auctent-owner-key");
    if (current) return current;
    const previous = localStorage.getItem("veyscope-owner-key") || "";
    if (previous) localStorage.setItem("auctent-owner-key", previous);
    return previous;
  });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [secret, setSecret] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState("");
  const [integrity, setIntegrity] = useState(null);
  const [previewing, setPreviewing] = useState("");
  const [auditFilter, setAuditFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const recoveryInput = useRef(null);
  const go = (p) => {
    setMenuOpen(false);
    location.hash = p;
    setPage(p);
    window.scrollTo(0, 0);
  };
  const showLoop = () => {
    setMenuOpen(false);
    if (page !== "home") go("home");
    window.setTimeout(
      () =>
        document.getElementById("loop")?.scrollIntoView({ behavior: "smooth" }),
      page === "home" ? 0 : 50,
    );
  };
  async function refresh(quiet = false) {
    try {
      const [s, r] = await Promise.all([api("/status"), api("/registry")]);
      setApiOnline(true);
      setStatus(s);
      setRegistry(r);
      if (s.configured && key) {
        try { setData(await api("/dashboard", "GET", key)); }
        catch (cause) { setData(null); if (!quiet) setError(cause.message); return; }
      } else setData(null);
      if (!quiet) setError("");
    } catch (e) {
      setApiOnline(false);
      if (!quiet) setError(e.message);
    }
  }
  useEffect(() => {
    refresh();
  }, [key]);
  useEffect(() => {
    const f = () => {setPage(location.hash.slice(1) || "home");setMenuOpen(false);};
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event) => {if (event.key === "Escape") setMenuOpen(false);};
    addEventListener("keydown", close);
    return () => removeEventListener("keydown", close);
  }, [menuOpen]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) refresh(true); }, 10000);
    return () => clearInterval(timer);
  }, [key, page]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(timer);
  }, [notice]);
  async function run(fn) {
    try {
      setError("");
      await fn();
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }
  const action = (path, method, body) => api(path, method, key, body);
  function lockConsole() {
    localStorage.removeItem("auctent-owner-key");
    localStorage.removeItem("veyscope-owner-key");
    setKey("");
    setData(null);
    setNotice("Console locked on this browser");
    go("setup");
  }
  async function recoverOwnerFromFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setRecovering(true);
    setError("");
    try {
      if (file.size > 256) {
        throw Error("Choose the small recovery.key file from this Auctent data directory.");
      }
      const credential = (await file.text()).trim();
      if (!/^aur_[A-Za-z0-9_-]{43}$/.test(credential)) {
        throw Error("Choose the recovery.key file from this Auctent data directory.");
      }
      const result = await api("/owner/recover", "POST", credential);
      localStorage.setItem("auctent-owner-key", result.key);
      localStorage.removeItem("veyscope-owner-key");
      setKey(result.key);
      setSecret({ title: "Your new owner key", value: result.key });
      go("overview");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setRecovering(false);
    }
  }
  async function exportAudit() {
    try {
      const payload = await action("/audit/export");
      const href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"}));
      const link = document.createElement("a");
      link.href = href;
      link.download = `auctent-audit-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
      setNotice(`Exported ${payload.count} audit events`);
    } catch (cause) { setError(cause.message); }
  }
  return (
    <div className="product">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header>
        <button onClick={() => go("home")}>
          <Logo />
        </button>
        <nav>
          <button onClick={showLoop}>How it works</button>
          <button onClick={() => go("integrate")}>Integrations</button>
          <button onClick={() => go(status?.configured ? "agents" : "setup")}>
            Agents
          </button>
        </nav>
        <div>
          <Button onClick={() => go(status?.configured ? "overview" : "setup")}>
            OPEN CONSOLE <ArrowRight size={16} />
          </Button>
          <button className="menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
        {menuOpen && <nav className="mobile-navigation" id="mobile-navigation" aria-label="Mobile navigation"><button onClick={showLoop}><span>01</span> HOW IT WORKS <ArrowRight size={16}/></button><button onClick={() => go("integrate")}><span>02</span> INTEGRATIONS <ArrowRight size={16}/></button><button onClick={() => go(status?.configured ? "agents" : "setup")}><span>03</span> AGENTS <ArrowRight size={16}/></button></nav>}
      </header>
      {notice && <div className="notice" role="status"><Check size={16} /> {notice}</div>}
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {page === "home" ? (
        <main id="main-content">
          <div className="signal-header"><span><i /> {apiOnline === null ? "CONNECTING" : apiOnline ? "SYSTEM ONLINE" : "REGISTRY OFFLINE"} <b>/</b> LOCAL REGISTRY</span><span>IDENTITY <b>→</b> AUTHORITY <b>→</b> EVIDENCE</span><span>AUCTENT / 01</span></div>
          <section className="hero">
            <motion.div initial={reducedMotion ? false : {opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.65,ease:[0.16,1,0.3,1]}}>
              <p className="eyebrow hero-badge"><span>■</span> AGENT AUTHORITY / DEFINED</p>
              <h1>
                <span>EVERY AGENT</span>
                <span>GETS A</span>
                <em>BOUNDARY.</em>
              </h1>
              <p className="hero-aside">[ KNOW YOUR AGENT / KEEP CONTROL ]</p>
              <p className="lead">
                Give each AI agent a name, a narrow mandate, and a record of what it tried to do. Then let it work.
              </p>
              <div className="hero-buttons">
                <Button
                  onClick={() => go(status?.configured ? "overview" : "setup")}
                >
                  ENTER THE CONTROL ROOM <ArrowRight size={18} />
                </Button>
                <Button plain onClick={showLoop}>
                  EXPLORE THE SYSTEM
                </Button>
              </div>
              <div className="hero-notes">
                <span>
                  <Fingerprint size={19} /> IDENTITY ISSUED
                </span>
                <span>
                  <Shield size={19} /> MANDATE ENFORCED
                </span>
                <span>
                  <RotateCw size={19} /> ACTIONS RECORDED
                </span>
              </div>
            </motion.div>
            <motion.div className="demo-panel" initial={reducedMotion ? false : {opacity:0,x:30}} animate={{opacity:1,x:0}} transition={{duration:0.7,delay:0.18,ease:[0.16,1,0.3,1]}}><PolicyLab /></motion.div>
            <div className="hero-visual" aria-hidden="true"><span className="visual-cross cross-a">+</span><span className="visual-cross cross-b">+</span><span className="visual-tag">AUTHORITY FIELD / ACTIVE</span><span className="visual-scan" /></div>
          </section>
          <div className="signal-strip" aria-hidden="true"><div>VERIFY THE AGENT <span>✳</span> SCOPE THE ACTION <span>✳</span> RECORD THE OUTCOME <span>✳</span> REVOKE THE KEY <span>✳</span> VERIFY THE AGENT <span>✳</span> SCOPE THE ACTION <span>✳</span> RECORD THE OUTCOME <span>✳</span> REVOKE THE KEY <span>✳</span></div></div>
          <section className="statement">
            <div className="statement-copy">
              <p className="eyebrow">01 / THE EVIDENCE</p>
              <h2>
                EVERY ACTION
                <br />
                <span>LEAVES A LINE.</span>
              </h2>
              <p>
                Give an agent room to work without giving it a blank check. Each tool request gets a policy decision and a readable record.
              </p>
              <div className="statement-index"><span>01</span><span>REQUEST / DECISION / OUTCOME</span></div>
            </div>
            <div className="receipt-stage" aria-label="Illustration of an agent action receipt">
              <div className="receipt-offset" aria-hidden="true" />
              <div className="action-receipt">
                <div className="receipt-top"><span>▲ AUCTENT / EXAMPLE RECEIPT</span><span>FORMAT PREVIEW</span></div>
                <div className="receipt-heading"><small>AGENT ACTION RECEIPT</small><strong>files.read<span>↗</span></strong></div>
                <dl>
                  <div><dt>AGENT</dt><dd>research-scout</dd></div>
                  <div><dt>RESOURCE</dt><dd>workspace/report.md</dd></div>
                  <div><dt>POLICY</dt><dd>active scope matched</dd></div>
                </dl>
                <div className="receipt-decision"><Check size={24} strokeWidth={2.5} /><div><span>DECISION / 200</span><strong>ALLOWED</strong></div><small>TOOL MAY RUN</small></div>
                <div className="receipt-foot"><span>HASH-LINKED AUDIT ENTRY</span><span>01 / 01</span></div>
              </div>
              <span className="receipt-stage-caption">DECISION RECORDED BEFORE EXECUTION ↗</span>
            </div>
          </section>
          <section className="features" id="loop">
            <div>
              <p className="eyebrow">02 / THE CONTROL LOOP</p>
              <h2>
                IDENTITY.<br />
                LIMITS.<br />
                EVIDENCE.
              </h2>
              <p className="feature-deck">A permission system for agents that act in your name.</p>
            </div>
            <div>
              {[
                [
                  Fingerprint,
                  "Give it an identity",
                  "Register an agent, issue a unique key, and share a signed public card with its current scopes.",
                ],
                [
                  Shield,
                  "Set the boundary",
                  "Allow named tools, resources and amount limits. Unmatched requests are denied before your tool runs.",
                ],
                [
                  ShieldOff,
                  "See it. Stop it.",
                  "Every decision enters a hash-linked audit log. Rotate a key or revoke an agent instantly.",
                ],
              ].map(([Icon, title, detail], i) => (
                <article key={title}>
                  <b>0{i + 1}</b>
                  <Icon size={28} />
                  <div>
                    <h3>{title}</h3>
                    <p>{detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="integration-story">
            <motion.div initial={reducedMotion ? false : {y:26}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:0.25}} transition={{duration:0.65,ease:[0.16,1,0.3,1]}}>
              <p className="eyebrow">03 / THE INTEGRATION</p>
              <h2>CONTROL<br />LIVES IN<br /><em>THE CALL.</em></h2>
              <p>Wrap a real tool call. Auctent checks the agent’s current scope first, records the decision, then records the agent-reported outcome.</p>
              <button onClick={() => go("integrate")}>Explore the integration <ArrowUpRight size={17} /></button>
            </motion.div>
            <motion.div className="story-code" initial={reducedMotion ? false : {y:34}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:0.2}} transition={{duration:0.65,delay:0.12,ease:[0.16,1,0.3,1]}}>
              <div><span><i /> agent-tool.mjs</span><span>NODE SDK</span></div>
              <pre>{`const guard = createAuctent({ agentKey });

const report = await guard.run(
  {
    action: 'files.read',
    resource: 'workspace/report.md'
  },
  () => readFile('report.md', 'utf8')
);

// Denied calls never reach readFile.`}</pre>
              <p><ShieldCheck size={17} /> Fails closed when the registry is unreachable</p>
            </motion.div>
          </section>
          <section className="bottom">
            <div>
              <p className="eyebrow">04 / TAKE THE CONTROLS</p>
              <h2>
                LET THEM WORK.<br />
                KEEP THE LINE.
              </h2>
            </div>
            <Button
              onClick={() => go(status?.configured ? "overview" : "setup")}
            >
              Open Auctent <ArrowRight size={18} />
            </Button>
          </section>
        </main>
      ) : page === "setup" ? (
        <main id="main-content" className="setup">
          <div>
            <p className="eyebrow">YOUR OWN CONTROL PLANE</p>
            <h1>
              Start with
              <br />
              an owner.
            </h1>
            <p>
              Auctent runs on your machine. Setup creates a private owner key for
              managing agents. There is no cloud account or external dependency.
            </p>
            <div className="setup-points">
              <span>✓ Owner key stays with you</span>
              <span>✓ Agent keys are shown once</span>
              <span>✓ Default deny policy</span>
            </div>
          </div>
          <div className="setup-box">
            {!status?.configured ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = e.currentTarget.elements.name.value;
                  run(async () => {
                    const d = await api("/setup", "POST", "", { name });
                    localStorage.setItem("auctent-owner-key", d.key);
                    setKey(d.key);
                    setSecret({ title: "Your owner key", value: d.key });
                    go("overview");
                  });
                }}
              >
                <small>01 / OWNER SETUP</small>
                <h2>Who is responsible?</h2>
                <p>
                  Use your name or team name. This identifies the owner of every
                  agent you register.
                </p>
                <label>
                  Owner name
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    placeholder="Your team"
                  />
                </label>
                <Button type="submit">
                  Create owner <ArrowRight size={17} />
                </Button>
              </form>
            ) : !data ? (
              <div className="unlock-stack"><form
                onSubmit={(e) => {
                  e.preventDefault();
                  const next = e.currentTarget.elements.key.value;
                  localStorage.setItem("auctent-owner-key", next);
                  setKey(next);
                }}
              >
                <small>WELCOME BACK</small>
                <h2>Unlock your console.</h2>
                <p>Enter the owner key created for this local instance.</p>
                <label>
                  Owner key
                  <input
                    name="key"
                    type="password"
                    required
                    placeholder="auo_…"
                  />
                </label>
                <Button type="submit">
                  Unlock <ArrowRight size={17} />
                </Button>
              </form>
              <div className="recovery-panel">
                <span className="eyebrow">LOST YOUR KEY?</span>
                <p>Select <code>.data/auctent/recovery.key</code> inside this project on the computer hosting the registry. On macOS, press ⇧⌘G in the file picker to enter its path. Auctent will issue and display a new owner key while keeping your agents and audit trail.</p>
                <input ref={recoveryInput} className="recovery-file-input" type="file" accept=".key,text/plain" tabIndex={-1} aria-hidden="true" onChange={recoverOwnerFromFile} />
                <Button plain onClick={() => recoveryInput.current?.click()}>{recovering ? "Recovering…" : "Recover owner key"} <KeyRound size={16} /></Button>
                <small>The old owner key stops working immediately. Keep this recovery file private.</small>
              </div></div>
            ) : (
              <div>
                <h2>Console unlocked.</h2>
                <p>{data.owner} owns this registry.</p>
                <Button onClick={() => go("overview")}>
                  Open console <ArrowRight size={17} />
                </Button>
              </div>
            )}
          </div>
        </main>
      ) : (
        <div className="console">
          <aside className={data ? "workspace-nav unlocked" : "workspace-nav"} aria-label="Console navigation">
            <p>
              WORKSPACE <span>LOCAL</span>
            </p>
            <button
              className={page === "overview" ? "selected" : ""}
              onClick={() => go("overview")}
            >
              <Shield size={18} /> Overview
            </button>
            <button
              className={page === "agents" ? "selected" : ""}
              onClick={() => go("agents")}
            >
              <Fingerprint size={18} /> Agents <b>{data?.agents.length || 0}</b>
            </button>
            <button
              className={page === "audit" ? "selected" : ""}
              onClick={() => go("audit")}
            >
              <RotateCw size={18} /> Audit trail
            </button>
            <hr />
            <p>DEVELOPERS</p>
            <button
              className={page === "integrate" ? "selected" : ""}
              onClick={() => go("integrate")}
            >
              <Terminal size={18} /> Integration
            </button>
            <div className="aside-note">
              <ShieldCheck />
              <strong>Under your control</strong>
              <small>Data and signing keys stay on this host.</small>
            </div>
            {data && <button className="lock-action" onClick={lockConsole}><LockKeyhole size={17} /> Lock</button>}
          </aside>
          <main id="main-content" className="console-main">
            {!status?.configured && page !== "integrate" ? (
              <div className="empty-access">
                <h1>Set up Auctent first.</h1>
                <Button onClick={() => go("setup")}>
                  Set up <ArrowRight size={17} />
                </Button>
              </div>
            ) : !data && page !== "integrate" ? (
              <div className="empty-access">
                <h1>Unlock the console.</h1>
                <Button onClick={() => go("setup")}>
                  Unlock <ArrowRight size={17} />
                </Button>
              </div>
            ) : page === "overview" ? (
              <>
                <div className="page-head">
                  <div>
                    <p className="eyebrow">WORKSPACE OVERVIEW</p>
                    <h1>
                      Good to know
                      <br />
                      <em>who’s acting.</em>
                    </h1>
                    <p>
                      Every agent, permission decision, and access change in one
                      place.
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setCreating(true);
                      go("agents");
                    }}
                  >
                    <Plus size={18} /> Register agent
                  </Button>
                </div>
                <div className="stats">
                  <div>
                    <span>REGISTERED AGENTS</span>
                    <strong>{data.agents.length}</strong>
                    <small>Identities in this registry</small>
                  </div>
                  <div>
                    <span>ACTIVE AGENTS</span>
                    <strong>
                      {data.agents.filter((a) => !a.revokedAt).length}
                    </strong>
                    <small>Keys still authorized</small>
                  </div>
                  <div>
                    <span>DECISIONS RECORDED</span>
                    <strong>
                      {
                        data.events.filter(
                          (e) =>
                            e.kind === "action.allowed" ||
                            e.kind === "action.denied",
                        ).length
                      }
                    </strong>
                    <small>Allowed and denied calls</small>
                  </div>
                </div>
                {data.agents.length === 0 && <div className="first-run">
                  <div><span className="eyebrow">START HERE</span><h2>Make your first tool call accountable.</h2><p>Register an agent, give it a single read permission, then run the working file tool from this repository.</p></div>
                  <ol><li><span>01</span> Register an agent</li><li><span>02</span> Save its one-time key</li><li><span>03</span> Run the guarded example</li></ol>
                  <Button onClick={() => {setCreating(true);go("agents");}}>Register first agent <ArrowRight size={16} /></Button>
                </div>}
                <div className="section-head">
                  <div>
                    <p className="eyebrow">YOUR AGENTS</p>
                    <h2>Registered identities</h2>
                  </div>
                  <button onClick={() => go("agents")}>Manage all →</button>
                </div>
                <div className="table">
                  <div className="table-head">
                    <span>AGENT</span>
                    <span>SCOPES</span>
                    <span>STATUS</span>
                  </div>
                  {data.agents.length ? (
                    data.agents.map((a) => (
                      <button key={a.id} onClick={() => go("agents")}>
                        <span>
                          <Fingerprint size={18} /> {a.name}
                        </span>
                        <span>{a.scopes.length} permissions</span>
                        <span>{a.revokedAt ? "Revoked" : "Active"} →</span>
                      </button>
                    ))
                  ) : (
                    <p className="empty">No agents yet.</p>
                  )}
                </div>
                <div className="section-head">
                  <div>
                    <p className="eyebrow">LATEST ACTIVITY</p>
                    <h2>Decision timeline</h2>
                  </div>
                  <button onClick={() => go("audit")}>View trail →</button>
                </div>
                <Events items={data.events.slice(0, 4)} agents={data.agents} />
              </>
            ) : page === "agents" ? (
              <>
                <div className="page-head compact">
                  <div>
                    <p className="eyebrow">IDENTITY & AUTHORITY</p>
                    <h1>
                      Your agents<span className="accent">.</span>
                    </h1>
                    <p>
                      Issue credentials, define scopes, and withdraw access.
                    </p>
                  </div>
                  <Button onClick={() => setCreating(!creating)}>
                    <Plus size={18} /> Register agent
                  </Button>
                </div>
                {creating && (
                  <div className="editor">
                    <p className="eyebrow">NEW IDENTITY</p>
                    <h2>Register an agent</h2>
                    <ScopeForm
                      onCancel={() => setCreating(false)}
                      onSubmit={(v) =>
                        run(async () => {
                          const d = await action("/agents", "POST", v);
                          setCreating(false);
                          setSecret({
                            title: "Key for " + d.agent.name,
                            value: d.key,
                          });
                        })
                      }
                    />
                  </div>
                )}
                {data.agents.length ? (
                  data.agents.map((a) => (
                    <article className="agent-card" key={a.id}>
                      <div className="agent-top">
                        <Fingerprint size={30} />
                        <div>
                          <h2>
                            {a.name}{" "}
                            <small className={a.revokedAt ? "revoked" : ""}>
                              {a.revokedAt ? "REVOKED" : "ACTIVE"}
                            </small>
                          </h2>
                          <p>{a.description || "No description"}</p>
                          <span>
                            ID {a.id.slice(0, 8)} · Key ending {a.keyHint} ·
                            Created {new Date(a.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="chips">
                        {a.scopes.map((s, i) => (
                          <span key={i}>
                            {s.action} → {s.resources.join(", ")}
                            {s.maxAmount !== null ? " · ≤" + s.maxAmount : ""}
                          </span>
                        ))}
                      </div>
                      <div className="agent-actions">
                        <button
                          onClick={async () => {
                            const url =
                              location.origin + "/api/agents/" + a.id + "/card";
                            try { await navigator.clipboard.writeText(url); setNotice("Public card URL copied"); }
                            catch { setError("Could not copy the card URL. Check clipboard permission."); }
                          }}
                        >
                          <Copy size={16} /> Copy card URL
                        </button>
                        <button onClick={() => setPreviewing(previewing === a.id ? "" : a.id)}><Play size={16} /> Test permission</button>
                        {!a.revokedAt && (
                          <>
                            <button
                              onClick={() =>
                                setEditing(editing === a.id ? "" : a.id)
                              }
                            >
                              <Shield size={16} /> Edit scopes
                            </button>
                            <button
                              onClick={() =>
                                run(async () => {
                                  const d = await action(
                                    "/agents/" + a.id + "/rotate",
                                    "POST",
                                  );
                                  setSecret({
                                    title: "New key for " + a.name,
                                    value: d.key,
                                  });
                                })
                              }
                            >
                              <RotateCw size={16} /> Rotate key
                            </button>
                            <button
                              className="danger"
                              onClick={() => {
                                if (
                                  confirm(
                                    "Revoke " +
                                      a.name +
                                      "? Its key stops working immediately.",
                                  )
                                )
                                  run(() =>
                                    action(
                                      "/agents/" + a.id + "/revoke",
                                      "POST",
                                    ),
                                  );
                              }}
                            >
                              <ShieldOff size={16} /> Revoke
                            </button>
                          </>
                        )}
                      </div>
                      {previewing === a.id && <AgentPlayground agent={a} action={action} />}
                      {editing === a.id && (
                        <ScopeForm
                          initial={a}
                          onCancel={() => setEditing("")}
                          onSubmit={(v) =>
                            run(async () => {
                              await action(
                                "/agents/" + a.id + "/scopes",
                                "PUT",
                                { scopes: v.scopes },
                              );
                              setEditing("");
                            })
                          }
                        />
                      )}
                    </article>
                  ))
                ) : (
                  <div className="empty-state">
                    <Fingerprint size={30} />
                    <h3>No agents yet</h3>
                    <p>Register one to issue a scoped credential.</p>
                    <Button onClick={() => setCreating(true)}>
                      Register agent →
                    </Button>
                  </div>
                )}
              </>
            ) : page === "audit" ? (
              <>
                <div className="page-head compact">
                  <div>
                    <p className="eyebrow">ACCOUNTABILITY</p>
                    <h1>
                      Audit trail<span className="accent">.</span>
                    </h1>
                    <p>Each event includes the previous event’s hash.</p>
                  </div>
                  <div className="audit-head-actions">
                    <Button plain onClick={exportAudit}><Download size={18} /> Export all</Button>
                    <Button plain onClick={() => run(async () => setIntegrity(await action("/audit/verify")))}><ShieldCheck size={18} /> Verify integrity</Button>
                  </div>
                </div>
                {integrity && (
                  <div className="integrity">
                    <ShieldCheck />
                    <strong>
                      {integrity.valid ? "Chain intact" : "Chain mismatch"}
                    </strong>
                    <span>
                      {integrity.valid
                        ? integrity.count +
                          " events verified · head " +
                          integrity.head.slice(0, 16) +
                          "…"
                        : "Mismatch at " + integrity.at}
                    </span>
                  </div>
                )}
                <div className="audit-toolbar"><span>Showing the latest {data.events.length} events. Export includes the full record.</span><div role="group" aria-label="Filter audit events">{[["all","All"],["action.allowed","Allowed"],["action.denied","Denied"],["action.reported","Outcomes"]].map(([value,label])=><button key={value} className={auditFilter===value?"selected":""} onClick={()=>setAuditFilter(value)}>{label}</button>)}</div></div>
                <Events items={data.events.filter((event)=>auditFilter==="all"||event.kind===auditFilter)} agents={data.agents} full emptyMessage={auditFilter==="all" ? "No events yet. Run a guarded tool to start the trail." : "No events match this filter."} />
              </>
            ) : (
              <>
                <div className="page-head compact">
                  <div>
                    <p className="eyebrow">BUILD WITH AUCTENT</p>
                    <h1>
                      Integration<span className="accent">.</span>
                    </h1>
                    <p>
                      A small Node SDK and a REST API for any agent framework. Authorize before the real tool executes.
                    </p>
                  </div>
                </div>
                <div className="docs">
                  <div>
                    <section>
                      <span>01</span>
                      <h2>Register and scope an agent</h2>
                      <p>
                        Create an identity in Agents. Add tool names and
                        resource patterns. Copy its key when it appears.
                      </p>
                    </section>
                    <section>
                      <span>02</span>
                      <h2>Wrap the real tool</h2>
                      <p>
                        Use the included Node SDK. It refuses to call the tool when policy denies access or the registry is unreachable.
                      </p>
                      <pre>
                        {"import { createAuctent } from './packages/agent-sdk/src/index.js';\n\nconst guard = createAuctent({\n  agentKey: process.env.AUCTENT_AGENT_KEY\n});\n\nconst result = await guard.run(\n  { action: 'files.read', resource: 'workspace/report.md' },\n  () => readFile('report.md', 'utf8')\n);"}
                      </pre>
                    </section>
                    <section>
                      <span>03</span>
                      <h2>Report the outcome</h2>
                      <p>
                        The SDK sends the returned event ID to <code>POST /api/receipt</code> after execution. Outcomes are labeled agent-reported. It flags a failed receipt without suggesting the tool is safe to retry.
                      </p>
                    </section>
                    <section>
                      <span>04</span>
                      <h2>Verify identity</h2>
                      <p>
                        Read <code>GET /api/agents/:id/card</code> for an Ed25519 signed card. Pin this registry’s public key fingerprint through a trusted channel, then verify the signature and current revocation status.
                      </p>
                      <div className="trust-anchor"><span>THIS REGISTRY'S PUBLIC KEY FINGERPRINT</span><code>{registry?.fingerprint || "Loading registry key…"}</code><button onClick={async()=>{try {await navigator.clipboard.writeText(registry.fingerprint);setNotice("Registry fingerprint copied");}catch{setError("Could not copy the fingerprint.");}}} disabled={!registry}>Copy fingerprint <Copy size={14}/></button></div>
                      <p>Use <code>node examples/verify-card.mjs &lt;card-url&gt; &lt;pinned-fingerprint&gt;</code> in a relying application.</p>
                    </section>
                  </div>
                  <aside>
                    <div>
                      <Terminal />
                      <h3>Working example</h3>
                      <p>
                        Run <code>node examples/guarded-agent.mjs</code> with a
                        key. It performs a real local file read after
                        authorization.
                      </p>
                    </div>
                    <div>
                      <ShieldCheck />
                      <h3>Security boundary</h3>
                      <p>
                        Your app must enforce the decision. Bypassing this API
                        bypasses policy. A local signature proves what this
                        instance issued, not human identity or independently
                        attested execution.
                      </p>
                    </div>
                  </aside>
                </div>
              </>
            )}
          </main>
        </div>
      )}
      {secret && (
        <div className="modal-backdrop" onMouseDown={() => setSecret(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setSecret(null)}>
              <X />
            </button>
            <KeyRound size={30} />
            <p className="eyebrow">ONE-TIME CREDENTIAL</p>
            <h2>{secret.title}</h2>
            <p>Save this now. Keys cannot be recovered from the registry.</p>
            <div className="secret">{secret.value}</div>
            <Button onClick={async () => {try {await navigator.clipboard.writeText(secret.value);setNotice("Copied to clipboard");} catch {setError("Could not copy. Select and save this key manually.");}}}>
              <Copy size={16} /> Copy
            </Button>
            <Button plain onClick={() => setSecret(null)}>
              I have saved it
            </Button>
          </div>
        </div>
      )}
      <footer>
        <Logo />
        <span>Know Your Agent · Identity, authority, evidence.</span>
        <span>© {new Date().getFullYear()} Auctent</span>
      </footer>
    </div>
  );
}
