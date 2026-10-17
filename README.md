# ⚡ LoadTester Kit (`loadtester-kit`)

> Zero-config, adaptive k6 load and overload testing suite for any web project. Generates custom test scenarios, injects npm scripts, outputs interactive HTML reports, and provides an embedded **Developer Metrics Glossary & Benchmark Guide**.

[![npm version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](https://www.npmjs.com/package/loadtester-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node: >=16](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)](https://nodejs.org/)

---

## 🎯 Features

* 🔍 **Smart Framework & Route Detection**: Automatically detects **Next.js** (App & Pages router), **Vite**, **Express / Fastify**, **Astro**, and Monorepos (Turborepo/pnpm). Discovers and balances traffic across `/`, `/api/health`, `/sitemap.xml`, and `/robots.txt`.
* ⚡ **Realistic Overload Simulation**: Pre-configured with multi-stage traffic surges (Warmup 10 VUs → Surge 50 VUs → Overload Stress 100 VUs → Recovery Ramp-down) with human jitter.
* 📦 **Automatic `package.json` Integration**: Injects ready-to-run scripts (`test:load`, `test:load:local`, `test:load:live`, `seeResult`) into your target project.
* 🛡️ **Edge & WAF Detection**: Detects and tracks Vercel / Cloudflare DDoS challenge blocks (`403 Forbidden` / `X-Vercel-Mitigated: challenge`) with support for bypass tokens.
* 📊 **Interactive HTML Report + Embedded Glossary**: Produces `summary.html` with latency charts, percentile distributions, AND an interactive, searchable **Glossary of Terms** directly explaining what every metric means in plain English!
* 🩺 **Built-in Doctor Diagnostic**: `loadtester doctor` validates your Node runtime, discovers `k6` across system PATHs, detects local project frameworks, and checks if servers are listening.

---

## 🚀 Quick Start

Run inside any web project root:

```bash
# Initialize and adapt to your project
npx loadtester-kit init
```

Or install as a dev dependency:

```bash
npm install -D loadtester-kit
# or: pnpm add -D loadtester-kit
```

---

## 🩺 Diagnostics (`loadtester doctor`)

Run the doctor command at any time to verify your environment before running tests:

```bash
npx loadtester-kit doctor
```

Output:
```
🩺 Running LoadTester Kit Doctor...

  ✓ Node.js Runtime: v20.x (supported >= 16.0.0)
  ✓ k6 Load Engine: k6 v0.49.0
  ✓ Target Project: my-nextjs-app (Framework: nextjs)
  ✓ loadTester.js: Present
  ✓ Local Server (port 3000): Active & Listening

🎉 Environment check complete!
```

---

## 🛠️ Injected Scripts

Once initialized, your project's `package.json` has these scripts ready:

| Script | Command | Purpose |
| :--- | :--- | :--- |
| `npm run test:load` | `k6 run loadTester.js` | Runs default k6 test script |
| `npm run test:load:local` | `k6 run -e TARGET_URL=http://localhost:3000 loadTester.js` | Stress tests local server |
| `npm run test:load:live` | `k6 run -e TARGET_URL=https://your-domain.com loadTester.js` | Stress tests staging/production |
| `npm run seeResult` | Opens `summary.html` | Opens interactive HTML dashboard in default browser |

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
> **NEVER run load tests against development servers (`next dev` or `pnpm dev`)!**
> 
> In development mode, Next.js compiles TypeScript on every incoming request, disables caching, and generates source maps. Under 50 VUs, the single-threaded Node.js event loop will freeze, causing **fake 6,000ms - 12,000ms latency**.
> 
> **Always test against a production build:**
> ```bash
> pnpm build
> pnpm start
> # Then in a separate terminal:
> pnpm test:load:local
> ```
> Production builds serve pre-compiled pages and static assets in **< 20ms**.

---

## ⚙️ CLI Options & Commands

```bash
# Initialize with custom port and URL
npx loadtester-kit init --port 8080 --url https://staging.myapp.com

# Re-generate loadTester.js and overwrite existing
npx loadtester-kit init --force

# Run environment health check
npx loadtester-kit doctor

# Open the latest summary.html
npx loadtester-kit report

# Print the glossary of metrics in your terminal
npx loadtester-kit glossary

# Export standalone glossary HTML page
npx loadtester-kit glossary:export
```

---

## 📦 Publishing to npm

To publish this package to npm:

```bash
# 1. Login to your npm account
npm login

# 2. Test package files before publishing
npm pack --dry-run

# 3. Publish to npm registry
npm publish --access public
```

---

## 📄 License

MIT © DevRig
