#!/usr/bin/env node

/**
 * LoadTester Kit CLI
 * Zero-config, adaptive k6 load testing suite generator and reporter.
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

function printHelp() {
  console.log(`
⚡ LoadTester Kit — Adaptive Load & Overload Testing Suite

USAGE:
  $ npx loadtester-kit [command] [options]
  $ loadtester [command] [options]

COMMANDS:
  init            Scan project, generate adaptive loadTester.js, and inject npm scripts (default)
  run [mode]      Run k6 test directly ('local' or 'live', e.g. 'loadtester run local')
  doctor          Run diagnostic environment and dependency check (Node, k6, ports)
  report          Open summary.html in your default browser
  glossary        View the complete developer metrics glossary in your terminal
  glossary:export Export the standalone glossary to glossary.html

OPTIONS:
  --port <port>   Specify local dev port (default: auto-detected or 3000)
  --url <url>     Specify live production URL (e.g. --url https://my-app.vercel.app)
  --force         Overwrite existing loadTester.js if present
  --version, -v   Print package version
  --help, -h      Display this help menu
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
      resolve(false);
    });
    socket.connect(port, "127.0.0.1");
  });
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

  // 3. Project Structure
  const targetDir = process.cwd();
  const profile = detectProject(targetDir);
  console.log(`  ✓ Target Project: \x1b[32m${profile.name}\x1b[0m (Framework: \x1b[36m${profile.framework}\x1b[0m)`);

  const hasScript = fs.existsSync(path.join(targetDir, "loadTester.js"));
  console.log(`  ${hasScript ? "✓" : "○"} loadTester.js: ${hasScript ? "\x1b[32mPresent\x1b[0m" : "\x1b[33mNot yet generated (run 'loadtester init')\x1b[0m"}`);

  // 4. Port Check
  const portOpen = await isPortActive(profile.localPort);
  if (portOpen) {
    console.log(`  ✓ Local Server (port ${profile.localPort}): \x1b[32mActive & Listening\x1b[0m`);
  } else {
    console.log(`  ○ Local Server (port ${profile.localPort}): \x1b[33mNot currently running\x1b[0m (Start app before test:load:local)`);
  }

  console.log(`\n🎉 Environment check complete!\n`);
}

function handleInit() {
  const targetDir = process.cwd();
  console.log(`\n🔍 Inspecting project in: \x1b[36m${targetDir}\x1b[0m...`);

  const profile = detectProject(targetDir);

  // Parse command line overrides
  const portIdx = args.indexOf("--port");
  if (portIdx !== -1 && args[portIdx + 1]) {
    profile.localPort = parseInt(args[portIdx + 1], 10);
  }

  const urlIdx = args.indexOf("--url");
  if (urlIdx !== -1 && args[urlIdx + 1]) {
    profile.liveUrl = args[urlIdx + 1];
  }

  const isForce = args.includes("--force");

  console.log(`  ✓ Detected framework: \x1b[32m${profile.framework}\x1b[0m`);
  console.log(`  ✓ Target port: \x1b[32m${profile.localPort}\x1b[0m`);
  console.log(`  ✓ Discovered ${profile.routes.length} test endpoints:`);
  profile.routes.forEach((r) => {
    console.log(`    - [${Math.round(r.weight * 100)}%] ${r.name} (${r.path})`);
  });

  const targetScriptPath = path.join(targetDir, "loadTester.js");
  if (fs.existsSync(targetScriptPath) && !isForce) {
    console.log(`\n⚠️  \x1b[33mloadTester.js already exists!\x1b[0m Use \x1b[36m--force\x1b[0m to overwrite.`);
  } else {
    const scriptContent = generateLoadTesterScript(profile);
    fs.writeFileSync(targetScriptPath, scriptContent, "utf8");
    console.log(`\n  ✅ Created: \x1b[32mloadTester.js\x1b[0m (with embedded reporter & developer glossary)`);
  }

  // Update package.json
  const updatedPkg = updateTargetPackageJson(profile);
  if (updatedPkg) {
    console.log(`  ✅ Added npm scripts to: \x1b[32mpackage.json\x1b[0m:`);
    console.log(`     • test:load       -> k6 run loadTester.js`);
    console.log(`     • test:load:local -> k6 run -e TARGET_URL=http://localhost:${profile.localPort} loadTester.js`);
    console.log(`     • test:load:live  -> k6 run -e TARGET_URL=${profile.liveUrl} loadTester.js`);
    console.log(`     • seeResult       -> Opens summary.html`);
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
  console.log(`   1. Start your app in production mode: \x1b[36mnpm run build && npm run start\x1b[0m`);
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
  const mode = args[1] || "local";
  const profile = detectProject(process.cwd());

  let targetUrl = `http://localhost:${profile.localPort}`;
  if (mode === "live") {
    targetUrl = profile.liveUrl;
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

function handleVersion() {
  const pkg = require("../package.json");
  console.log(`loadtester-kit v${pkg.version}`);
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
  case "report":
    handleReport();
    break;
  case "glossary":
    handleGlossary();
    break;
  case "glossary:export":
    handleGlossaryExport();
    break;
  case "--version":
  case "-v":
    handleVersion();
    break;
  case "--help":
  case "-h":
  case "help":
    printHelp();
    break;
  default:
    if (command.startsWith("-")) {
      printHelp();
    } else {
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
    }
}
