#!/usr/bin/env node

/**
 * LoadTester Kit CLI
 * Zero-config, adaptive k6 load testing suite generator and reporter for any architecture.
 */

const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");
const net = require("net");
const { detectProject } = require("../lib/detector");
const { generateLoadTesterScript } = require("../lib/generator");
const { updateTargetPackageJson, updateTargetGitignore } = require("../lib/updater");
const { GLOSSARY_TERMS } = require("../lib/glossary");
const { generateGlossaryHtml } = require("../lib/reporter-template");

const args = process.argv.slice(2);
const command = args[0] || "init";

function printShortHelp() {
  console.log(`
⚡ LoadTester Kit — Short Command Reference (-h)

USAGE:
  $ npx loadtester-kit <command> [options]
  $ loadtester <command> [options]

COMMANDS:
  init             Scan architecture, generate adaptive loadTester.js, and inject npm scripts
  run [mode]       Directly execute k6 test ('local' or 'live', e.g. 'loadtester run local')
  services, list   List all detected workspace services, frameworks, and ports
  doctor           Validate environment (Node, k6) and check if service ports are listening
  report           Open summary.html interactive dashboard in default browser
  commands, guide  View in-depth developer guide for all commands and npm scripts
  config:init      Generate boilerplate loadtester.config.js for custom architecture topologies
  glossary         View complete developer metrics glossary in terminal
  glossary:export  Export standalone glossary.html documentation file

OPTIONS:
  --app, -a <name> Target a specific service in a monorepo / multi-service architecture
  --all            Generate a unified multi-service load test covering all detected services
  --port <port>    Specify local dev port (overrides auto-detection)
  --url <url>      Specify live production URL (e.g. --url https://my-app.vercel.app)
  --force          Overwrite existing loadTester.js if present
  --version, -v    Print package version
  -h               Show this concise short help menu
  --help           Show full in-depth command reference with detailed descriptions

💡 For full in-depth command descriptions and examples, run: npx loadtester-kit --help
`);
}

function printLongHelp() {
  console.log(`
=================================================================================
⚡ LOADTESTER KIT — FULL DEVELOPER COMMAND REFERENCE (--help / Long Mode)
=================================================================================

Adaptive, zero-config k6 load and overload testing suite generator for any
architecture: Monorepos (Turborepo, Nx, pnpm), polyglot multi-service stacks
(Next.js + Python FastAPI / Go / Rust), Docker Compose, and monoliths.

USAGE:
  $ npx loadtester-kit [command] [options]
  $ loadtester [command] [options]

COMMANDS & IN-DEPTH DESCRIPTIONS:

  \x1b[1m\x1b[36minit [options]\x1b[0m
  • \x1b[1mDescription:\x1b[0m
      Inspects your repository topology, detects frameworks and languages,
      discovers standard endpoints (/, /api/health, /docs, sitemaps, robots),
      generates a tailored staged k6 load test script (loadTester.js) with
      realistic multi-stage surges (10 -> 50 -> 100 VUs), human thinking jitter,
      and Edge WAF challenge tracking. Automatically injects ready-to-run
      npm scripts into package.json and adds report artifacts to .gitignore.
  • \x1b[1mOptions:\x1b[0m
      --app, -a <name>  Target a specific service in a monorepo or workspace
      --all             Generate a unified multi-service test covering all services
      --port <port>     Override detected local port
      --url <url>       Specify live production/staging URL
      --force           Overwrite existing loadTester.js if present
  • \x1b[1mExamples:\x1b[0m
      $ npx loadtester-kit init
      $ npx loadtester-kit init --all
      $ npx loadtester-kit init --app web
      $ npx loadtester-kit init --port 8080 --url https://staging.myapp.com

  \x1b[1m\x1b[36mrun [local | live | <url>] [options]\x1b[0m
  • \x1b[1mDescription:\x1b[0m
      Directly launches k6 against the detected local port, live URL, or custom URL.
      Passes the TARGET_URL environment variable to loadTester.js automatically,
      eliminating the need to memorize manual k6 command-line syntax.
  • \x1b[1mOptions:\x1b[0m
      --app, -a <name>  Target a specific service's port in a monorepo setup
  • \x1b[1mExamples:\x1b[0m
      $ npx loadtester-kit run local
      $ npx loadtester-kit run live
      $ npx loadtester-kit run https://staging.my-api.com
      $ npx loadtester-kit run local --app api

  \x1b[1m\x1b[36mservices (alias: list)\x1b[0m
  • \x1b[1mDescription:\x1b[0m
      Recursively scans workspace packages and directories (apps/*, packages/*,
      backend, frontend, services, docker-compose), extracts each service's
      framework, runtime language, local port, and discovered endpoints,
      and displays a formatted directory table in the terminal.
  • \x1b[1mExamples:\x1b[0m
      $ npx loadtester-kit services

  \x1b[1m\x1b[36mdoctor\x1b[0m
  • \x1b[1mDescription:\x1b[0m
      Executes a comprehensive system and architecture diagnostic check:
      1. Validates Node.js runtime version (>= 16.0.0).
      2. Locates k6 executable across system PATH locations.
      3. Identifies workspace architecture (Monorepo, Polyglot, Docker, Monolith).
      4. Tests TCP network sockets for every detected service port to verify
         whether servers are actively running and listening.
      5. Checks whether loadTester.js exists in the workspace.
  • \x1b[1mExamples:\x1b[0m
      $ npx loadtester-kit doctor

  \x1b[1m\x1b[36mreport\x1b[0m
  • \x1b[1mDescription:\x1b[0m
      Cross-platform launcher that opens the HTML dashboard (summary.html)
      generated by your latest load test in your default web browser.
      Displays latency percentiles (p90, p95, p99), response duration trends,
      and the embedded Developer Metrics Glossary.
  • \x1b[1mExamples:\x1b[0m
      $ npx loadtester-kit report

  \x1b[1m\x1b[36mconfig:init\x1b[0m
  • \x1b[1mDescription:\x1b[0m
      Scaffolds a starter 'loadtester.config.js' configuration file in the project
      root. Use this for bespoke, proprietary, or custom multi-service setups
      to configure custom service topologies, custom ports, custom routes,
      custom stages (VUs/duration), and custom latency thresholds.
  • \x1b[1mExamples:\x1b[0m
      $ npx loadtester-kit config:init
      $ npx loadtester-kit config:init --force

  \x1b[1m\x1b[36mglossary\x1b[0m
  • \x1b[1mDescription:\x1b[0m
      Outputs the complete performance metrics dictionary directly in your
      terminal, explaining key indicators like TTFB, p95, http_req_failed,
      Virtual Users (VUs), WAF challenge blocks, and healthy benchmark targets.
  • \x1b[1mExamples:\x1b[0m
      $ npx loadtester-kit glossary

  \x1b[1m\x1b[36mglossary:export\x1b[0m
  • \x1b[1mDescription:\x1b[0m
      Compiles the Developer Metrics Glossary into a standalone, styled
      'glossary.html' file you can commit to documentation or share with teams.
  • \x1b[1mExamples:\x1b[0m
      $ npx loadtester-kit glossary:export

  \x1b[1m\x1b[36mcommands (alias: guide)\x1b[0m
  • \x1b[1mDescription:\x1b[0m
      Displays the full developer command & workflow guide, covering CLI commands,
      injected package.json npm scripts, monorepo recipes, and dev-mode rules.
  • \x1b[1mExamples:\x1b[0m
      $ npx loadtester-kit commands
      $ npx loadtester-kit help init

INJECTED NPM SCRIPTS IN PACKAGE.JSON:
  • npm run test:load:local    Stress test local server on detected port
  • npm run test:load:live     Stress test live production or staging URL
  • npm run test:load          Execute default k6 test scenario
  • npm run test:load:<svc>    Target a specific service in a monorepo
  • npm run seeResult          Open summary.html report in default browser
  • npm run test:load:help     Display developer command guide & cheat sheet

SUPPORTED ARCHITECTURES:
  • Monorepos: Turborepo, Nx, pnpm workspaces, npm/yarn workspaces, Bun, Lerna
  • Polyglot & Multi-Service: Next.js/Vite + Python FastAPI/Flask, Go, Rust, PHP, Ruby
  • Containerized: Docker Compose service & port extraction
  • Monoliths: Next.js, Nuxt, SvelteKit, Remix, Astro, Vite, Angular, Express, Fastify, NestJS
  • Custom: Fully configurable via loadtester.config.js
`);
}

function ensureK6InPath() {
  const commonPaths = [
    "C:\\Program Files\\k6",
    "C:\\Program Files (x86)\\k6",
    "C:\\ProgramData\\chocolatey\\bin",
    (process.env.LOCALAPPDATA || "") + "\\Programs\\k6",
    "/usr/local/bin",
    "/opt/homebrew/bin"
  ];
  for (const p of commonPaths) {
    if (p && fs.existsSync(path.join(p, process.platform === "win32" ? "k6.exe" : "k6"))) {
      if (!process.env.PATH.includes(p)) {
        process.env.PATH = `${p}${path.delimiter}${process.env.PATH}`;
      }
      break;
    }
  }
}

ensureK6InPath();

function checkK6Installed() {
  try {
    const out = execSync("k6 version", { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] });
    return out.trim();
  } catch {
    return null;
  }
}

function isPortActive(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(400);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
  });
}

function parseAppArg() {
  const appIdx = args.indexOf("--app") !== -1 ? args.indexOf("--app") : args.indexOf("-a");
  if (appIdx !== -1 && args[appIdx + 1] && !args[appIdx + 1].startsWith("-")) {
    return args[appIdx + 1];
  }
  return null;
}

async function handleDoctor() {
  console.log(`\n🩺 \x1b[1mRunning LoadTester Kit Doctor...\x1b[0m\n`);

  // 1. Node Version Check
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.replace("v", "").split(".")[0], 10);
  if (majorVersion >= 16) {
    console.log(`  ✓ Node.js Runtime: \x1b[32m${nodeVersion}\x1b[0m (supported >= 16.0.0)`);
  } else {
    console.log(`  ✗ Node.js Runtime: \x1b[31m${nodeVersion}\x1b[0m (Requires Node >= 16.0.0)`);
  }

  // 2. k6 Binary Check
  const k6Version = checkK6Installed();
  if (k6Version) {
    console.log(`  ✓ k6 Load Engine: \x1b[32m${k6Version}\x1b[0m`);
  } else {
    console.log(`  ⚠️  k6 Load Engine: \x1b[33mNot found in PATH\x1b[0m`);
    console.log(`     Install k6 via:`);
    console.log(`     • Windows: \x1b[36mwinget install k6 --source winget\x1b[0m or \x1b[36mchoco install k6\x1b[0m`);
    console.log(`     • macOS:   \x1b[36mbrew install k6\x1b[0m`);
    console.log(`     • Linux:   \x1b[36msudo apt install k6\x1b[0m`);
  }

  // 3. Architecture & Services Inspection
  const targetDir = process.cwd();
  const profile = detectProject(targetDir);

  const archColor = profile.architecture === "single-service" ? "\x1b[32m" : "\x1b[35m";
  console.log(`  ✓ Architecture Topology: ${archColor}${profile.architecture.toUpperCase()}\x1b[0m (${profile.workspaceType || "standard"})`);
  console.log(`  ✓ Project Root: \x1b[36m${profile.name}\x1b[0m in ${targetDir}`);

  console.log(`\n  \x1b[1mDetected Services & Listening Status:\x1b[0m`);
  for (const svc of profile.services) {
    const portOpen = await isPortActive(svc.localPort);
    const statusText = portOpen
      ? "\x1b[32m● Active & Listening\x1b[0m"
      : "\x1b[33m○ Offline / Not Listening\x1b[0m";

    console.log(`    • \x1b[1m${svc.name}\x1b[0m [${svc.framework} / ${svc.language}] (port ${svc.localPort}, path: ${svc.path})`);
    console.log(`      Status: ${statusText} — ${svc.routes.length} routes detected`);
  }

  const hasScript = fs.existsSync(path.join(targetDir, "loadTester.js"));
  console.log(`\n  ${hasScript ? "✓" : "○"} loadTester.js: ${hasScript ? "\x1b[32mPresent\x1b[0m" : "\x1b[33mNot yet generated (run 'loadtester init')\x1b[0m"}`);

  console.log(`\n🎉 Environment & Architecture diagnostic complete!\n`);
}

function handleServices() {
  const targetDir = process.cwd();
  const profile = detectProject(targetDir);

  console.log(`\n📦 \x1b[1mDiscovered Architecture & Services:\x1b[0m`);
  console.log(`   Architecture: \x1b[35m${profile.architecture.toUpperCase()}\x1b[0m (Workspace: ${profile.workspaceType})`);
  console.log(`   Total Services: \x1b[32m${profile.services.length}\x1b[0m\n`);

  profile.services.forEach((s, idx) => {
    console.log(`\x1b[1m${idx + 1}. ${s.name}\x1b[0m (ID: \x1b[36m${s.id}\x1b[0m)`);
    console.log(`   Directory: ${s.path}`);
    console.log(`   Framework: ${s.framework} | Language: ${s.language}`);
    console.log(`   Local Port: ${s.localPort}`);
    console.log(`   Routes (${s.routes.length}):`);
    s.routes.forEach((r) => {
      console.log(`     - [${Math.round((r.weight || 0.1) * 100)}%] ${r.name} (${r.path})`);
    });
    console.log(``);
  });
}

function handleConfigInit() {
  const targetDir = process.cwd();
  const configPath = path.join(targetDir, "loadtester.config.js");

  if (fs.existsSync(configPath) && !args.includes("--force")) {
    console.log(`\n⚠️  \x1b[33mloadtester.config.js already exists!\x1b[0m Use \x1b[36m--force\x1b[0m to overwrite.\n`);
    return;
  }

  const template = `/**
 * LoadTester Kit — Custom Architecture Configuration
 * Use this file to define custom services, topology, ports, and custom k6 thresholds.
 */

module.exports = {
  // Architecture type: "monorepo" | "multi-service" | "single-service" | "containerized" | "custom"
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

  // Custom k6 Overload Stages
  stages: [
    { duration: "10s", target: 10 },
    { duration: "30s", target: 50 },
    { duration: "30s", target: 100 },
    { duration: "10s", target: 0 }
  ],

  // Global Performance Thresholds
  thresholds: {
    http_req_duration: ["p(95)<400", "p(99)<750"],
    http_req_failed: ["rate<0.01"]
  }
};
`;

  fs.writeFileSync(configPath, template, "utf8");
  console.log(`\n✅ Generated template: \x1b[32mloadtester.config.js\x1b[0m\n`);
}

function handleInit() {
  const targetDir = process.cwd();
  console.log(`\n🔍 Inspecting architecture in: \x1b[36m${targetDir}\x1b[0m...`);

  const requestedApp = parseAppArg();
  const isAll = args.includes("--all");
  const isForce = args.includes("--force");

  const profile = detectProject(targetDir, { app: requestedApp });

  // Overrides from CLI flags
  const portIdx = args.indexOf("--port");
  if (portIdx !== -1 && args[portIdx + 1]) {
    const customPort = parseInt(args[portIdx + 1], 10);
    profile.localPort = customPort;
    if (profile.selectedService) profile.selectedService.localPort = customPort;
  }

  const urlIdx = args.indexOf("--url");
  if (urlIdx !== -1 && args[urlIdx + 1]) {
    profile.liveUrl = args[urlIdx + 1];
    if (profile.selectedService) profile.selectedService.liveUrl = args[urlIdx + 1];
  }

  console.log(`  ✓ Architecture: \x1b[35m${profile.architecture.toUpperCase()}\x1b[0m (${profile.workspaceType})`);
  console.log(`  ✓ Detected services (${profile.services.length}):`);
  profile.services.forEach((s) => {
    const isTargeted = profile.selectedService && profile.selectedService.id === s.id;
    const targetBadge = isTargeted ? " \x1b[32m[TARGETED]\x1b[0m" : "";
    console.log(`    • \x1b[1m${s.name}\x1b[0m (ID: ${s.id}, ${s.framework}/${s.language}, port ${s.localPort})${targetBadge}`);
  });

  if (profile.services.length > 1 && !requestedApp && !isAll) {
    console.log(`\n💡 \x1b[36mTip:\x1b[0m Multiple services detected!`);
    console.log(`   • To test all services simultaneously: \x1b[1mnpx loadtester-kit init --all\x1b[0m`);
    console.log(`   • To target a specific service:        \x1b[1mnpx loadtester-kit init --app <id>\x1b[0m\n`);
  }

  const targetScriptPath = path.join(targetDir, "loadTester.js");
  if (fs.existsSync(targetScriptPath) && !isForce) {
    console.log(`\n⚠️  \x1b[33mloadTester.js already exists!\x1b[0m Use \x1b[36m--force\x1b[0m to overwrite.`);
  } else {
    const scriptContent = generateLoadTesterScript(profile, { all: isAll, app: requestedApp });
    fs.writeFileSync(targetScriptPath, scriptContent, "utf8");
    console.log(`\n  ✅ Created: \x1b[32mloadTester.js\x1b[0m (with embedded reporter & developer glossary)`);
  }

  // Update package.json scripts
  const updatedPkg = updateTargetPackageJson(profile);
  if (updatedPkg) {
    console.log(`  ✅ Added npm scripts to: \x1b[32mpackage.json\x1b[0m:`);
    console.log(`     • test:load       -> k6 run loadTester.js`);
    console.log(`     • test:load:local -> k6 run -e TARGET_URL=http://localhost:${profile.localPort} loadTester.js`);
    console.log(`     • test:load:live  -> k6 run -e TARGET_URL=${profile.liveUrl} loadTester.js`);
    console.log(`     • seeResult       -> Opens summary.html`);
    if (profile.services.length > 1) {
      profile.services.forEach((s) => {
        console.log(`     • test:load:${s.id} -> Runs load test against ${s.name} (port ${s.localPort})`);
      });
    }
  }

  // Update .gitignore
  const updatedGitignore = updateTargetGitignore(targetDir);
  if (updatedGitignore) {
    console.log(`  ✅ Added summary.html to: \x1b[32m.gitignore\x1b[0m`);
  }

  // Check k6 runtime availability
  const k6Ver = checkK6Installed();
  if (k6Ver) {
    console.log(`  ✓ k6 CLI is installed: ${k6Ver}`);
  } else {
    console.log(`\n⚠️  \x1b[33mk6 is not currently installed or not in PATH.\x1b[0m`);
    console.log(`   Install k6 to run load tests:`);
    console.log(`   • Windows (winget): \x1b[36mwinget install k6 --source winget\x1b[0m`);
    console.log(`   • Windows (choco):  \x1b[36mchoco install k6\x1b[0m`);
    console.log(`   • macOS (brew):     \x1b[36mbrew install k6\x1b[0m`);
    console.log(`   • Linux:            \x1b[36msudo apt install k6\x1b[0m\n`);
  }

  console.log(`\n🚀 \x1b[1mNext Steps:\x1b[0m`);
  console.log(`   1. Start your services in production mode`);
  console.log(`   2. Run local overload test:           \x1b[36mnpm run test:load:local\x1b[0m`);
  console.log(`   3. View interactive HTML dashboard:   \x1b[36mnpm run seeResult\x1b[0m\n`);
}

function handleReport() {
  const summaryPath = path.join(process.cwd(), "summary.html");
  if (!fs.existsSync(summaryPath)) {
    console.error(`\n❌ summary.html not found. Run a load test first with: npm run test:load:local\n`);
    process.exit(1);
  }

  const openCmd =
    process.platform === "win32"
      ? `start "" "${summaryPath}"`
      : process.platform === "darwin"
      ? `open "${summaryPath}"`
      : `xdg-open "${summaryPath}"`;

  try {
    execSync(openCmd);
    console.log(`\n📊 Opened \x1b[32msummary.html\x1b[0m in your browser.\n`);
  } catch (err) {
    console.error(`Failed to open browser: ${err.message}`);
  }
}

function handleRun() {
  const mode = args[1] && !args[1].startsWith("-") ? args[1] : "local";
  const requestedApp = parseAppArg();
  const profile = detectProject(process.cwd(), { app: requestedApp });

  const activePort = profile.selectedService ? profile.selectedService.localPort : profile.localPort;
  const activeLiveUrl = profile.selectedService ? profile.selectedService.liveUrl : profile.liveUrl;

  let targetUrl = `http://localhost:${activePort}`;
  if (mode === "live") {
    targetUrl = activeLiveUrl;
  } else if (mode.startsWith("http://") || mode.startsWith("https://")) {
    targetUrl = mode;
  }

  console.log(`\n⚡ Launching k6 test against: \x1b[36m${targetUrl}\x1b[0m...\n`);

  const child = spawn("k6", ["run", "-e", `TARGET_URL=${targetUrl}`, "loadTester.js"], {
    stdio: "inherit",
    shell: true,
  });

  child.on("close", (code) => {
    if (code === 0) {
      console.log(`\n✅ Load test completed successfully! View report with: \x1b[36mnpm run seeResult\x1b[0m\n`);
    } else {
      console.log(`\n⚠️  Test finished with code ${code} (one or more thresholds were crossed).\n`);
    }
  });
}

function handleGlossary() {
  console.log(`\n======================================================`);
  console.log(`📖 LOADTESTER DEVELOPER METRICS GLOSSARY & HEALTH GUIDE`);
  console.log(`======================================================\n`);

  let currentCategory = "";
  GLOSSARY_TERMS.forEach((term) => {
    if (term.category !== currentCategory) {
      currentCategory = term.category;
      console.log(`\n\x1b[1m\x1b[34m[ ${currentCategory.toUpperCase()} ]\x1b[0m`);
    }

    console.log(`\n\x1b[1m\x1b[36m• ${term.shortName} (${term.term})\x1b[0m`);
    console.log(`  ${term.description}`);
    if (term.benchmark) {
      console.log(`  \x1b[32mTarget Benchmark:\x1b[0m ${term.benchmark}`);
    }
    if (term.troubleshooting) {
      console.log(`  \x1b[33mDiagnostic:\x1b[0m ${term.troubleshooting}`);
    }
  });
  console.log(`\n`);
}

function handleGlossaryExport() {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Developer Metrics Glossary</title>
</head>
<body style="background:#0b1120;margin:0;padding:40px 20px;">
  ${generateGlossaryHtml()}
</body>
</html>`;

  fs.writeFileSync(path.join(process.cwd(), "glossary.html"), html, "utf8");
  console.log(`\n✅ Exported standalone glossary to: \x1b[32mglossary.html\x1b[0m\n`);
}

function handleCommands(subcommand) {
  if (subcommand === "init") {
    console.log(`
\x1b[1m\x1b[36mloadtester init\x1b[0m — Project & Architecture Initialization

\x1b[1mWHAT IT DOES:\x1b[0m
  1. Inspects your workspace or project directory to detect framework, language, and ports.
  2. Discovers standard endpoints (/, /api/health, /docs, /openapi.json, sitemap, robots).
  3. Generates a tailored k6 script (loadTester.js) with staged traffic surges and WAF detection.
  4. Injects ready-to-run scripts into package.json (test:load, test:load:local, test:load:live, seeResult).
  5. Adds summary.html to .gitignore so test artifacts aren't committed.

\x1b[1mUSAGE:\x1b[0m
  $ npx loadtester-kit init [options]

\x1b[1mOPTIONS:\x1b[0m
  --app, -a <name>  Target a specific sub-app or service in a monorepo / multi-service workspace.
  --all             Generate a unified multi-service load test covering all detected services.
  --port <port>     Override auto-detected local development port (e.g. --port 8080).
  --url <url>       Specify live production/staging URL (e.g. --url https://staging.myapp.com).
  --force           Overwrite existing loadTester.js if already present.

\x1b[1mEXAMPLES:\x1b[0m
  $ npx loadtester-kit init
  $ npx loadtester-kit init --all
  $ npx loadtester-kit init --app web
  $ npx loadtester-kit init --port 4000 --url https://my-app.vercel.app
`);
    return;
  }

  if (subcommand === "run") {
    console.log(`
\x1b[1m\x1b[36mloadtester run\x1b[0m — Direct k6 Test Runner

\x1b[1mWHAT IT DOES:\x1b[0m
  Launches k6 directly against the configured local or live target URL.
  Eliminates the need to remember manual k6 command-line environment syntax.

\x1b[1mUSAGE:\x1b[0m
  $ npx loadtester-kit run [mode] [options]

\x1b[1mMODES:\x1b[0m
  local             Run test against local server (default port or auto-detected)
  live              Run test against live URL (production or staging)
  <custom-url>      Run test against any explicit URL (e.g. https://staging.api.com)

\x1b[1mOPTIONS:\x1b[0m
  --app, -a <name>  Select which service's port/URL to target in a monorepo.

\x1b[1mEXAMPLES:\x1b[0m
  $ npx loadtester-kit run local
  $ npx loadtester-kit run live
  $ npx loadtester-kit run https://qa-preview.myapp.com
  $ npx loadtester-kit run local --app api
`);
    return;
  }

  if (subcommand === "doctor") {
    console.log(`
\x1b[1m\x1b[36mloadtester doctor\x1b[0m — Diagnostic Health & Architecture Inspector

\x1b[1mWHAT IT DOES:\x1b[0m
  1. Validates your Node.js runtime version (>= 16.0.0).
  2. Discovers and checks k6 binary availability across system PATH locations.
  3. Detects architecture topology (Monorepo, Polyglot Multi-Service, Containerized, or Monolith).
  4. Scans every service in your workspace and tests its port socket (verifying whether it is currently listening).
  5. Checks whether loadTester.js is present.

\x1b[1mUSAGE:\x1b[0m
  $ npx loadtester-kit doctor
`);
    return;
  }

  if (subcommand === "services" || subcommand === "list") {
    console.log(`
\x1b[1m\x1b[36mloadtester services\x1b[0m — Workspace Service & Route Directory

\x1b[1mWHAT IT DOES:\x1b[0m
  Scans all directories in the project or workspace (apps/*, packages/*, backend, frontend, etc.),
  extracts framework, language, port, and detected routes for each service, and displays a formatted summary table.

\x1b[1mUSAGE:\x1b[0m
  $ npx loadtester-kit services
`);
    return;
  }

  if (subcommand === "report") {
    console.log(`
\x1b[1m\x1b[36mloadtester report\x1b[0m — Interactive Report Viewer

\x1b[1mWHAT IT DOES:\x1b[0m
  Cross-platform browser launcher that opens summary.html generated from your last load test.
  Equivalent to running 'npm run seeResult'.

\x1b[1mUSAGE:\x1b[0m
  $ npx loadtester-kit report
`);
    return;
  }

  if (subcommand === "config:init") {
    console.log(`
\x1b[1m\x1b[36mloadtester config:init\x1b[0m — Custom Architecture Config Boilerplate

\x1b[1mWHAT IT DOES:\x1b[0m
  Generates a starter 'loadtester.config.js' file in your project root, allowing you to define
  custom services, topologies, custom stages (VUs/duration), custom routes, and latency thresholds.

\x1b[1mUSAGE:\x1b[0m
  $ npx loadtester-kit config:init [--force]
`);
    return;
  }

  if (subcommand === "glossary") {
    console.log(`
\x1b[1m\x1b[36mloadtester glossary\x1b[0m — Developer Metrics Glossary & Benchmark Guide

\x1b[1mWHAT IT DOES:\x1b[0m
  Displays the full performance testing dictionary right in your terminal, detailing what every k6
  metric means (TTFB, p95, http_req_failed, VUs, WAF challenges), healthy benchmark targets, and diagnostics.

\x1b[1mUSAGE:\x1b[0m
  $ npx loadtester-kit glossary
  $ npx loadtester-kit glossary:export   # Exports standalone glossary.html
`);
    return;
  }

  // Full Developer Command Guide
  console.log(`
=================================================================================
⚡ \x1b[1mLOADTESTER KIT — DEVELOPER COMMAND & WORKFLOW GUIDE\x1b[0m
=================================================================================

\x1b[1m\x1b[34m[ 1. CLI COMMANDS REFERENCE ]\x1b[0m

  \x1b[1m\x1b[36mnpx loadtester-kit init [options]\x1b[0m
  • \x1b[1mWhat it does:\x1b[0m Auto-detects project architecture, generates loadTester.js, and injects npm scripts.
  • \x1b[1mOptions:\x1b[0m
      --all           Generate a unified test covering all services in a monorepo
      --app <id>      Target a specific service (e.g. --app web or --app api)
      --port <port>   Override default local port
      --url <url>     Specify live production URL
      --force         Overwrite existing loadTester.js

  \x1b[1m\x1b[36mnpx loadtester-kit run [local | live | <url>] [--app <id>]\x1b[0m
  • \x1b[1mWhat it does:\x1b[0m Runs k6 test directly without manual environment variables.

  \x1b[1m\x1b[36mnpx loadtester-kit doctor\x1b[0m
  • \x1b[1mWhat it does:\x1b[0m Environment check: validates Node version, k6 binary, architecture, and whether service ports are listening.

  \x1b[1m\x1b[36mnpx loadtester-kit services\x1b[0m
  • \x1b[1mWhat it does:\x1b[0m Lists all detected workspace services, directories, frameworks, ports, and routes.

  \x1b[1m\x1b[36mnpx loadtester-kit report\x1b[0m
  • \x1b[1mWhat it does:\x1b[0m Opens summary.html in your default web browser (same as 'npm run seeResult').

  \x1b[1m\x1b[36mnpx loadtester-kit config:init\x1b[0m
  • \x1b[1mWhat it does:\x1b[0m Generates a starter loadtester.config.js for custom architecture setups.

  \x1b[1m\x1b[36mnpx loadtester-kit glossary\x1b[0m
  • \x1b[1mWhat it does:\x1b[0m Prints complete developer metrics definitions, healthy benchmarks, and diagnostics.

  \x1b[1m\x1b[36mnpx loadtester-kit glossary:export\x1b[0m
  • \x1b[1mWhat it does:\x1b[0m Exports standalone glossary.html for your documentation.


\x1b[1m\x1b[34m[ 2. INJECTED NPM SCRIPTS IN YOUR PACKAGE.JSON ]\x1b[0m

  Once 'loadtester init' runs, these scripts are ready in your target project:

  • \x1b[1m\x1b[32mnpm run test:load:local\x1b[0m
    Stress tests your local server using the detected local port (e.g. http://localhost:3000).

  • \x1b[1m\x1b[32mnpm run test:load:live\x1b[0m
    Stress tests your live staging or production deployment URL.

  • \x1b[1m\x1b[32mnpm run test:load\x1b[0m
    Executes the default k6 loadTester.js script using default base URL.

  • \x1b[1m\x1b[32mnpm run test:load:<service>\x1b[0m  (In Monorepos / Multi-Service setups)
    Runs a load test targeting a specific workspace service's port (e.g. npm run test:load:api).

  • \x1b[1m\x1b[32mnpm run seeResult\x1b[0m
    Cross-platform command that opens the interactive summary.html report in your browser.

  • \x1b[1m\x1b[32mnpm run test:load:help\x1b[0m
    Displays this comprehensive developer guide at any time.


\x1b[1m\x1b[34m[ 3. TYPICAL DEVELOPER WORKFLOWS ]\x1b[0m

  \x1b[1mStandard Web App (Next.js, Vite, Astro, Express):\x1b[0m
    1. Initialize:             npx loadtester-kit init
    2. Start production build: npm run build && npm run start
    3. Verify environment:     npx loadtester-kit doctor
    4. Run local test:         npm run test:load:local
    5. View report:            npm run seeResult

  \x1b[1mMonorepo / Multi-Service (Turborepo, pnpm workspaces, FastAPI + Next.js):\x1b[0m
    1. Inspect workspace:      npx loadtester-kit services
    2. Initialize all:         npx loadtester-kit init --all
       (or single service):    npx loadtester-kit init --app web
    3. Run test:               npm run test:load:local
    4. View report:            npm run seeResult


\x1b[1m\x1b[33m[ 4. CRITICAL RULE: DEV MODE VS PRODUCTION MODE ]\x1b[0m
  ⚠️  NEVER run load tests against development servers ('next dev', 'vite', 'uvicorn --reload').
      Dev servers recompile TypeScript and disable caching on every request, creating fake 6,000ms+ lag.
      Always build and run production binaries before testing!

For deep-dive help on any command, run:
  $ npx loadtester-kit help <command>  (e.g. npx loadtester-kit help init)
`);
}

function handleVersion() {
  const pkg = require("../package.json");
  console.log(`loadtester-kit v${pkg.version}`);
}

// Global flag interceptors for help modes
if (args.includes("-h")) {
  printShortHelp();
  process.exit(0);
}

if (args.includes("--help") && command !== "--help") {
  if (command && !command.startsWith("-")) {
    handleCommands(command);
  } else {
    printLongHelp();
  }
  process.exit(0);
}

// Command Router
switch (command) {
  case "init":
    handleInit();
    break;
  case "run":
    handleRun();
    break;
  case "doctor":
    handleDoctor();
    break;
  case "services":
  case "list":
    handleServices();
    break;
  case "config:init":
    handleConfigInit();
    break;
  case "report":
    handleReport();
    break;
  case "glossary":
    handleGlossary();
    break;
  case "glossary:export":
    handleGlossaryExport();
    break;
  case "commands":
  case "guide":
    handleCommands(args[1]);
    break;
  case "help":
    if (args[1]) {
      handleCommands(args[1]);
    } else {
      printLongHelp();
    }
    break;
  case "--version":
  case "-v":
    handleVersion();
    break;
  case "--help":
    printLongHelp();
    break;
  case "-h":
    printShortHelp();
    break;
  default:
    if (command.startsWith("-")) {
      printShortHelp();
    } else {
      console.error(`Unknown command: ${command}`);
      printShortHelp();
      process.exit(1);
    }
}
