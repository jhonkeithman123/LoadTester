/**
 * Injects load testing npm scripts and gitignore entries into the target project
 */

const fs = require("fs");
const path = require("path");

function updateTargetPackageJson(profile) {
  if (!profile.packageJsonPath || !fs.existsSync(profile.packageJsonPath)) {
    return false;
  }

  try {
    const raw = fs.readFileSync(profile.packageJsonPath, "utf8");
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

    fs.writeFileSync(profile.packageJsonPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
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
