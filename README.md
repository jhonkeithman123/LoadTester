# ⚡ LoadTester Kit (`loadtester-kit`)

> Adaptive, zero-config k6 load and overload testing suite generator for **any architecture**: Monorepos (Turborepo, Nx, pnpm), polyglot multi-service stacks (Next.js + Python FastAPI / Go / Rust), Docker Compose, and monoliths. Features an embedded HTML reporter and interactive **Developer Metrics Glossary & Benchmark Guide**.

[![npm version](https://img.shields.io/badge/npm-v1.1.2-blue.svg)](https://www.npmjs.com/package/loadtester-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node: >=16](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

---

## 🎯 Features

* 🏗️ **Universal Architecture Engine**: Seamlessly detects and adapts to **any repository structure**:
  * **Monorepos & Workspaces**: Turborepo, Nx, pnpm workspaces, npm/yarn workspaces, Bun, and Lerna (`apps/*`, `packages/*`, `services/*`).
  * **Polyglot & Multi-Service**: Split frontend + backend repositories (e.g., Next.js / Vite + **Python FastAPI**, Flask, Django, **Go Gin/Echo**, **Rust Axum/Actix**, PHP Laravel, Ruby on Rails).
  * **Containerized**: Auto-extracts service definitions and exposed host ports from `docker-compose.yml` / `compose.yaml`.
  * **Single-App Monoliths**: Next.js (App & Pages router), Nuxt, SvelteKit, Remix, Astro, Vite, Angular, Express, Fastify, NestJS.
  * **Custom Architectures**: Fully customizable via `loadtester.config.js`.
* ⚡ **Realistic Overload Simulation**: Pre-configured with multi-stage traffic surges (Warmup 10 VUs → Surge 50 VUs → Overload Stress 100 VUs → Recovery Ramp-down) with human jitter.
* 🌐 **Multi-Service & Targeted Testing**: Run unified multi-service load tests across your entire architecture (`--all`), or target an individual service (`--app <id>`).
* 📦 **Automatic `package.json` Integration**: Injects ready-to-run scripts (`test:load`, `test:load:local`, `test:load:live`, `test:load:<service>`, `seeResult`) into your target project.
* 🛡️ **Edge & WAF Detection**: Detects and tracks Vercel / Cloudflare DDoS challenge blocks (`403 Forbidden` / `X-Vercel-Mitigated: challenge`) with support for bypass tokens.
* 📊 **Interactive HTML Report + Embedded Glossary**: Produces `summary.html` with latency charts, percentile distributions, AND an interactive, searchable **Glossary of Terms** directly explaining what every metric means in plain English!
* 🩺 **Deep Diagnostic Doctor**: `loadtester doctor` validates your Node runtime, discovers `k6`, maps out your architecture topology, and checks whether each service's port is active and listening.

---

## 🚀 Quick Start

Run inside any project or workspace root:

```bash
# Initialize and adapt to your project architecture
npx loadtester-kit init
```

Or install as a dev dependency:

```bash
npm install -D loadtester-kit
# or: pnpm add -D loadtester-kit
```

---

## 🏗️ Working with Monorepos & Multi-Service Architectures

### 1. Inspect Discovered Services

View all detected applications, services, frameworks, and ports across your workspace:

```bash
npx loadtester-kit services
```

Output:
```
📦 Discovered Architecture & Services:
   Architecture: MONOREPO (Workspace: turborepo)
   Total Services: 2

1. Frontend Web (ID: web)
   Directory: apps/web
   Framework: nextjs | Language: nodejs
   Local Port: 3000
   Routes (4):
     - [40%] Home Landing Page (/)
     - [30%] Health API (/api/health)
     - [15%] SEO Sitemap (/sitemap.xml)
     - [15%] SEO Robots (/robots.txt)

2. Backend API (ID: api)
   Directory: apps/api
   Framework: fastapi | Language: python
   Local Port: 8000
   Routes (3):
     - [40%] Home Landing Page (/)
     - [35%] API Health (/health)
     - [15%] OpenAPI Documentation (/docs)
```

### 2. Multi-Service Testing Modes

* **Unified Multi-Service Overload Test**: Test all services at the same time:
  ```bash
  npx loadtester-kit init --all
  npm run test:load:local
  ```
  *Distributes traffic across both `:3000` and `:8000` with per-service latency trend metrics.*

* **Target a Specific Service**: Test only one service within the workspace:
  ```bash
  npx loadtester-kit init --app api
  npm run test:load:local
  ```

---

## ⚙️ Custom Architecture Configuration (`loadtester.config.js`)

For bespoke, proprietary, or custom topologies, generate a config file:

```bash
npx loadtester-kit config:init
```

This creates a `loadtester.config.js`:

```javascript
module.exports = {
  architecture: "multi-service",
  services: [
    {
      id: "web",
      name: "Frontend Web Application",
      path: "./apps/web",
      framework: "nextjs",
      port: 3000,
      liveUrl: "https://your-domain.vercel.app",
      routes: [
        { id: "home", name: "Home Landing", path: "/", weight: 0.5 },
        { id: "api_health", name: "Health API", path: "/api/health", weight: 0.3, isJson: true }
      ]
    },
    {
      id: "api",
      name: "Backend API Service",
      path: "./backend",
      framework: "fastapi",
      port: 8000,
      liveUrl: "https://api.your-domain.com",
      routes: [
        { id: "health", name: "Service Health", path: "/health", weight: 0.6, isJson: true },
        { id: "docs", name: "OpenAPI Documentation", path: "/docs", weight: 0.4 }
      ]
    }
  ],
  stages: [
    { duration: "10s", target: 10 },
    { duration: "30s", target: 50 },
    { duration: "30s", target: 100 },
    { duration: "10s", target: 0 }
  ],
  thresholds: {
    http_req_duration: ["p(95)<400", "p(99)<750"],
    http_req_failed: ["rate<0.01"]
  }
};
```

---

## 🩺 Diagnostics (`loadtester doctor`)

Run diagnostics anytime to inspect your environment, architecture, and service statuses:

```bash
npx loadtester-kit doctor
```

Output:
```
🩺 Running LoadTester Kit Doctor...

  ✓ Node.js Runtime: v20.x (supported >= 16.0.0)
  ✓ k6 Load Engine: k6 v0.49.0
  ✓ Architecture Topology: MONOREPO (turborepo)
  ✓ Project Root: my-workspace in /path/to/project

  Detected Services & Listening Status:
    • Frontend Web [nextjs / nodejs] (port 3000, path: apps/web)
      Status: ● Active & Listening — 4 routes detected
    • Backend API [fastapi / python] (port 8000, path: apps/api)
      Status: ● Active & Listening — 3 routes detected

  ✓ loadTester.js: Present

🎉 Environment & Architecture diagnostic complete!
```

---

## 🛠️ Injected Scripts

Once initialized, your project's `package.json` includes:

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run test:load` | `k6 run loadTester.js` | Runs default k6 test script |
| `npm run test:load:local` | `k6 run -e TARGET_URL=http://localhost:3000 loadTester.js` | Stress tests local server |
| `npm run test:load:live` | `k6 run -e TARGET_URL=https://your-domain.com loadTester.js` | Stress tests staging/production |
| `npm run test:load:<service>` | `k6 run -e TARGET_URL=http://localhost:<port> loadTester.js` | Stress tests a specific service |
| `npm run seeResult` | Opens `summary.html` | Opens interactive HTML dashboard in default browser |
| `npm run test:load:help` | `npx loadtester-kit commands` | Displays interactive developer guide & command cheat sheet |

---

## 📖 Developer Metrics Glossary & Benchmark Cheat Sheet

The generated `summary.html` includes an interactive glossary. Here is the quick-reference cheat sheet:

| Metric | What It Means | Healthy Target | Common Diagnostic |
| :--- | :--- | :--- | :--- |
| **`http_req_duration`** | Total roundtrip time from request start to full response body. | `< 250ms` (APIs)<br>`< 500ms` (SSR) | If > 2s, check server CPU or synchronous blocking code. |
| **`http_req_waiting (TTFB)`** | Time to First Byte. How long server took to process and start sending response. | `< 100ms` | High TTFB means un-indexed DB queries or un-optimized SSR rendering. |
| **`p(90) / p(95) / p(99)`** | Percentiles: Response time below which 90%, 95%, or 99% of requests completed. | `p(95) < 350ms`<br>`p(99) < 600ms` | Averages hide spikes! Always look at `p(95)` and `p(99)` to catch tail latency. |
| **`http_req_failed`** | Percentage of requests that returned 4xx/5xx or dropped connection. | `0.00%` | 502/504 = reverse proxy timeout; 500 = unhandled exception or DB pool exhausted. |
| **`http_req_connecting`** | Time taken to establish TCP 3-way handshake. | `< 1ms` (local)<br>`< 50ms` (remote) | High values point to network latency or server socket backlog full. |
| **`http_req_blocked`** | Time waiting for a free TCP connection from connection pool. | `< 1ms` | High values indicate client-side port exhaustion or proxy delay. |
| **`VUs (Virtual Users)`** | Concurrent simulated users executing test loops in parallel. | Scenario-dependent | 50 VUs looping continuously equals thousands of human users per hour. |
| **`iterations`** | Total number of complete test scenario loops completed by all VUs. | Higher is better | Dropping iterations under load means the server slowed down. |
| **`WAF Challenges`** | Edge DDoS protection (Vercel/Cloudflare) blocking requests with HTTP 403. | `0` | Pass `-e VERCEL_BYPASS_TOKEN=...` or adjust rate limits. |

---

## ⚠️ Critical Rule: Dev Mode vs Production Mode

> [!CAUTION]
> **NEVER run load tests against development servers (`next dev`, `pnpm dev`, `uvicorn --reload`)!**
> 
> In development mode, compilers re-evaluate code on every incoming request, caching is disabled, and source maps are generated. Under 50 VUs, servers will choke and produce **fake 6,000ms - 12,000ms latency**.
> 
> **Always test against a production build:**
> ```bash
> pnpm build && pnpm start
> # Or for Python: uvicorn main:app --workers 4
> # Then in a separate terminal:
> pnpm test:load:local
> ```

---

## ⚙️ CLI Reference

```bash
# Architecture & Service Inspection
npx loadtester-kit services               # List all discovered services in workspace
npx loadtester-kit doctor                 # Check environment and active service ports

# Developer Guide & Deep-Dive Help
npx loadtester-kit commands               # Interactive developer command & workflow guide
npx loadtester-kit help <command>         # In-depth help for a specific command (e.g. help init)

# Suite Initialization
npx loadtester-kit init                   # Auto-adapt to workspace or single project
npx loadtester-kit init --all             # Unified overload suite covering all services
npx loadtester-kit init --app <id>        # Suite targeting a specific service
npx loadtester-kit init --port 8080       # Override port
npx loadtester-kit init --force           # Overwrite existing script

# Direct Execution
npx loadtester-kit run local              # Run test against local server
npx loadtester-kit run live               # Run test against live production URL

# Custom Configuration
npx loadtester-kit config:init            # Generate starter loadtester.config.js

# Reports & Glossary
npx loadtester-kit report                 # Open summary.html in browser
npx loadtester-kit glossary               # Print terminal glossary
npx loadtester-kit glossary:export        # Export glossary.html
```

---

## 📄 License

MIT © DevRig
