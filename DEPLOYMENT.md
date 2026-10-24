# Deploy Wardrail

Wardrail is a single-owner, single-process registry with persistent local storage. Deploy the Node server and the built web app together. A static-only host cannot provide the console, approvals or API.

## Vercel frontend

Import `Gravyie/KYA` into Vercel with production branch `main` and **Root Directory left at the repository root (`.`)**. Select Node 24 in the project settings. The root `vercel.json` supplies installation, build, output directory and client-side page routing. Remove stale dashboard overrides that point at an older app directory or start command. Add your existing domain under the project's Domains settings.

This deploys the landing page, docs and browser UI. The console, identity APIs and server-backed verification still require a backend; `/api` is intentionally not rewritten to HTML. Vercel's static build does not run `npm start` or deploy the Node server. Backend URLs are not secrets; owner keys and signing keys must never be frontend build variables.

## Free backend path (not deployed)

For zero ongoing hosting spend, the recommended next adaptation is a Cloudflare **Workers Free** API with **D1 Free** persistent storage. The current filesystem-backed Node server cannot be deployed there unchanged: extract portable HTTP handlers, implement transactional database storage, persist signing identity safely, and verify policy/approval/audit concurrency and free-plan CPU limits. Then proxy the frontend's `/api/*` requests to the Worker and configure the public identity origin. The local SDK and MCP wrappers remain client-side integrations.

Stay on Free plans, use the provider's supplied hostname initially and do not enable paid products or automatic upgrades. Free quotas limit availability; they are not unlimited capacity. D1 Free returns errors at its included limits rather than charging overages: https://developers.cloudflare.com/d1/platform/pricing/. Workers Free limits: https://developers.cloudflare.com/workers/platform/pricing/.

No backend has been deployed for the current release. The old Render `kya-api` service was deleted during project-scoped cleanup; no KYA/Wardrail AWS resources were identified. Unrelated cloud resources were left untouched. The Docker/VM instructions below remain available for self-hosting, but paid infrastructure is not authorized.

## Run on a host

Use Node 24 LTS. From the repository root:

```sh
npm ci --prefix apps/web
npm test
npm run build
npm start
```

Visit `http://127.0.0.1:5055/app`. **Create the owner and save its key before exposing this instance publicly.** A new registry allows its first visitor to become the owner. Use an SSH tunnel for initial setup on a remote host. Keep the recovery key separate from the owner key.

The product name is Wardrail. The `MIHARI_*` configuration, SDK symbols, key prefixes and signed data formats are retained for compatibility.

| Setting | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5055` | HTTP port |
| `MIHARI_HOST` | `127.0.0.1` | Listen address; keep loopback behind a local reverse proxy |
| `MIHARI_DATA_DIR` | `.data/mihari` | Persistent registry, signing key, recovery key and audit log |
| `MIHARI_PUBLIC_URL` | Request origin | Set the external HTTPS origin for public identity URLs |
| `MIHARI_RPC_<chainId>` | Built-in chain endpoint | Optional RPC override for on-chain identity |

Terminate TLS at a reverse proxy. Forward to the loopback port; The build generates Brotli/gzip variants and the Node server negotiates them; a proxy may also compress other responses. The server already sends year-long immutable caching for hashed assets and no-cache for the app shell. Keep API responses private and uncached. Configure HSTS only after HTTPS is correctly deployed. Do not expose the registry data directory as static files.

## Container

```sh
docker compose up --build -d
# First visit http://127.0.0.1:5055/app and complete setup.
# For a public deployment, set MIHARI_PUBLIC_URL=https://your-domain before startup.
```

The multi-stage image runs as an unprivileged user, excludes the Lab and development artifacts, and stores state in a named volume. Compose binds only to loopback, uses a read-only application filesystem, and supplies an init process. `/health` is the container readiness probe. The CI workflow includes a container build; verify the image on your deployment host before release.

MCP wrappers run **beside the MCP client**, not automatically inside this server container. Install/copy `packages/mcp` on the client machine, supply its own path in the MCP config, and point `MIHARI_URL` at the registry. Likewise install the SDK from a local checkout; packages are not published to npm. Paths shown by a containerized console refer to that container, so replace them with paths on the machine running your agent.

## Back up and recover

Stop the process before copying the **entire** data directory (or take a consistent filesystem snapshot). It contains sensitive signing and recovery material: encrypt backups and restrict access. Keep independent periodic audit exports with their trusted chain heads. Test a restore to a separate directory and port before relying on backups.

Never share one data directory between multiple Node processes or replicas. Do not use ephemeral/serverless storage. A missing volume creates a new registry and different signing identity.

For a lost owner key, run `npm run owner:recover` on the host using the same data-directory configuration. In Compose: `docker compose exec wardrail npm run owner:recover`. Rotation keeps agents and audit history, but invalidates the old owner key.

## Release checks

- Run `npm test` and `npm run build`; CI repeats both on Node 24.
- Set up an isolated registry, register an agent, exercise allow/ask/deny, approve once, export and verify the audit chain, and revoke the agent.
- Check desktop and mobile, keyboard dialogs, unavailable-server handling, automatic graphics fallback and reduced motion.
- Verify your HTTPS origin, proxy headers, persistent volume, backup/restore and owner recovery on the target host.
- This is not a multi-tenant hosted service or a security certification. Enforcement only applies to calls routed through the SDK/MCP boundary. Receipts remain agent-reported; revocation cannot undo a tool that already executed.

Implementation references: [Docker build guidance](https://docs.docker.com/build/building/best-practices/), [OWASP HTTP headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html), and [reduced motion](https://web.dev/articles/prefers-reduced-motion).
