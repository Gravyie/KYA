# KYA LLM-Powered Headless Browser Agent (Phase 1)

This preset agent operates a real headless browser via **Playwright**, utilizing an already-authenticated session (e.g. for X/Twitter). Rather than calling third-party platform APIs, the agent perceives the page through visual screenshots and structured accessibility trees, and executes physical browser actions (clicks, keyboard strokes, navigation).

Every inference decision and outcome judgment routes through **0G Compute**, backed by **TEE (Trusted Execution Environment)** attestations, guaranteeing unforgeable, witnessed execution.

---

## 1. Quickstart

### Step 1: Install Playwright Dependencies
```bash
npm install --prefix agents/runtime/browser-agent
```

### Step 2: One-Time Manual Login Setup
To give the headless browser access to your account without needing username/password credentials in code:

```bash
node agents/runtime/browser-agent/auth-setup.js
```

1. A visible (headed) Chromium browser will open directly to `https://x.com/login`.
2. Log into your account manually and complete any 2FA checks.
3. Once your feed is visible, return to the terminal and press `[ENTER]`.
4. The authenticated cookies and storage state are saved to `.storage/x-session.json`.

---

## 2. Running the Headless Browser Agent

To execute a task autonomously:

```bash
node agents/runtime/browser-agent/index.js "Post 'Autonomous KYA verification ping' on X"
```

The agent will:
1. Launch Chromium in **headless** mode (`headless: true`) using the saved session state.
2. Navigate to `https://x.com/home`.
3. Capture the page screenshot and interactive accessibility tree.
4. Consult 0G Compute (`qwen3.8-flash`, TEE-verified) to choose the next action (`click`, `type`, `press`).
5. Execute the action and loop until `task_complete` or 15 steps are reached.
6. Execute independent outcome verification via 0G Compute on the final page state.
7. Print the final structured JSON result with TEE attestation evidence.

---

## 3. How the 0G Compute TEE Guarantee Works

Unlike traditional AI agents that self-report success:
- **Per-Step Decisions**: Every perception-action choice made in [`agent-loop.js`](file:///home/ayush/Desktop/KYA/agents/runtime/browser-agent/agent-loop.js) is sent to the 0G Compute Router with `verify_tee: true`. The provider returns a cryptographic TEE attestation (`Action.evidence`), proving the agent could not fabricate its decision trail.
- **Outcome Verification**: After the task finishes, [`verify-outcome.js`](file:///home/ayush/Desktop/KYA/agents/runtime/browser-agent/verify-outcome.js) takes an independent auditor screenshot and queries 0G Compute for an objective judgment (`success`, `failure`, `uncertain`). This judgment also carries a TEE attestation.
- **Identical Trust Model**: This mirrors how `flight.quote` receipts are settled in `PassportRegistry.sol` using 0G evidence digests.

---

## 4. Environment Configuration

The agent strictly reuses your root `.env` settings:
```env
# 0G Compute Router
OG_COMPUTE_MODEL=qwen3.8-flash
OG_VERIFY_TEE=true
OG_COMPUTE_BASE_URL=https://router-api.0g.ai/v1
OG_COMPUTE_API_KEY=your_0g_compute_api_key_here
```

---

## 5. File Overview

- [`auth-setup.js`](file:///home/ayush/Desktop/KYA/agents/runtime/browser-agent/auth-setup.js): One-time headed browser login script.
- [`browser-controller.js`](file:///home/ayush/Desktop/KYA/agents/runtime/browser-agent/browser-controller.js): Mechanical Playwright wrapper for screenshots, clicking, typing, and accessibility trees.
- [`og-vision-client.js`](file:///home/ayush/Desktop/KYA/agents/runtime/browser-agent/og-vision-client.js): 0G Compute client with TEE attestation verification.
- [`agent-loop.js`](file:///home/ayush/Desktop/KYA/agents/runtime/browser-agent/agent-loop.js): 15-step perception-action loop.
- [`verify-outcome.js`](file:///home/ayush/Desktop/KYA/agents/runtime/browser-agent/verify-outcome.js): Auditor verification step.
- [`index.js`](file:///home/ayush/Desktop/KYA/agents/runtime/browser-agent/index.js): CLI entrypoint.
