/**
 * Injects load testing npm scripts and gitignore entries into the target project or workspace.
 */

const fs = require("fs");
const path = require("path");

function updateTargetPackageJson(profile, options = {}) {
  // If target has a package.json at root or selected service
  const targetPkgPath =
    profile.packageJsonPath ||
    (profile.selectedService && profile.selectedService.packageJsonPath) ||
    path.join(profile.targetDir, "package.json");

  if (!fs.existsSync(targetPkgPath)) {
    return false;
  }

  try {
    const raw = fs.readFileSync(targetPkgPath, "utf8");
    const pkg = JSON.parse(raw);

    pkg.scripts = pkg.scripts || {};

    const localPort = profile.localPort || 3000;
    const liveUrl = profile.liveUrl || "https://your-domain.vercel.app";

    // Cross-platform browser opener script
    const openCommand = "node -e \\\"const {exec} = require('child_process'); const p = process.platform === 'win32' ? 'start summary.html' : process.platform === 'darwin' ? 'open summary.html' : 'xdg-open summary.html'; exec(p);\\\"";

    pkg.scripts["test:load"] = "k6 run loadTester.js";
    pkg.scripts["test:load:local"] = `k6 run -e TARGET_URL=http://localhost:${localPort} loadTester.js`;
    pkg.scripts["test:load:live"] = `k6 run -e TARGET_URL=${liveUrl} loadTester.js`;
    pkg.scripts["seeResult"] = openCommand;
    pkg.scripts["test:load:help"] = "npx loadtester-kit commands";

    // In monorepos / multi-service setups, add service-specific run shortcuts
    if (profile.services && profile.services.length > 1) {
      pkg.scripts["test:load:all"] = "k6 run loadTester.js";
      profile.services.forEach((s) => {
        const sPort = s.localPort || 3000;
        const scriptKey = `test:load:${s.id}`;
        pkg.scripts[scriptKey] = `k6 run -e TARGET_URL=http://localhost:${sPort} loadTester.js`;
      });
    }

    fs.writeFileSync(targetPkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
    return true;
  } catch (err) {
    console.error("Failed to update target package.json:", err.message);
    return false;
  }
}

function updateTargetGitignore(targetDir) {
  const gitignorePath = path.join(targetDir, ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    return false;
  }

  try {
    let content = fs.readFileSync(gitignorePath, "utf8");
    const entriesToAdd = [];

    if (!content.includes("summary.html")) {
      entriesToAdd.push("summary.html");
    }

    if (entriesToAdd.length > 0) {
      if (!content.endsWith("\n")) {
        content += "\n";
      }
      content += "\n# LoadTester Report Artifacts\n" + entriesToAdd.join("\n") + "\n";
      fs.writeFileSync(gitignorePath, content, "utf8");
      return true;
    }
    return false;
  } catch (err) {
    console.error("Failed to update .gitignore:", err.message);
    return false;
  }
}

module.exports = {
  updateTargetPackageJson,
  updateTargetGitignore
};
