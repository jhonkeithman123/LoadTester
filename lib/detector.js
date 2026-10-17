/**
 * Project Framework and Route Detector
 * Inspects a project directory to adapt load testing scenarios automatically.
 */

const fs = require("fs");
const path = require("path");

function detectProject(targetDir = process.cwd()) {
  const profile = {
    targetDir,
    framework: "generic",
    name: path.basename(targetDir),
    localPort: 3000,
    liveUrl: "https://your-domain.vercel.app",
    isMonorepo: false,
    routes: [],
    packageJsonPath: null,
    hasGitignore: false
  };

  // Check for monorepo signatures
  if (
    fs.existsSync(path.join(targetDir, "turbo.json")) ||
    fs.existsSync(path.join(targetDir, "pnpm-workspace.yaml")) ||
    fs.existsSync(path.join(targetDir, "lerna.json"))
  ) {
    profile.isMonorepo = true;
  }

  // Check .gitignore
  if (fs.existsSync(path.join(targetDir, ".gitignore"))) {
    profile.hasGitignore = true;
  }

  // Read target package.json
  const pkgPath = path.join(targetDir, "package.json");
  let pkg = {};
  if (fs.existsSync(pkgPath)) {
    profile.packageJsonPath = pkgPath;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.name) profile.name = pkg.name;
    } catch {
      // Ignore parse error
    }
  }

  const allDeps = {
    ...(pkg.dependencies || {}),
    ...(pkg.devDependencies || {}),
    ...(pkg.peerDependencies || {})
  };

  // Framework detection
  if (
    allDeps.next ||
    fs.existsSync(path.join(targetDir, "next.config.js")) ||
    fs.existsSync(path.join(targetDir, "next.config.mjs")) ||
    fs.existsSync(path.join(targetDir, "next.config.ts"))
  ) {
    profile.framework = "nextjs";
    profile.localPort = 3000;
  } else if (
    allDeps.vite ||
    fs.existsSync(path.join(targetDir, "vite.config.js")) ||
    fs.existsSync(path.join(targetDir, "vite.config.ts"))
  ) {
    profile.framework = "vite";
    profile.localPort = 5173;
  } else if (
    allDeps.astro ||
    fs.existsSync(path.join(targetDir, "astro.config.mjs"))
  ) {
    profile.framework = "astro";
    profile.localPort = 4321;
  } else if (allDeps.express || allDeps.fastify || allDeps.koa || allDeps["@nestjs/core"]) {
    profile.framework = "express-or-api";
    profile.localPort = 3000;
  }

  // Check if target directory has custom script ports in package.json
  if (pkg.scripts) {
    const devScript = pkg.scripts.dev || pkg.scripts.start || "";
    const portMatch = devScript.match(/(?:-p|--port)\s+([0-9]{4,5})/);
    if (portMatch) {
      profile.localPort = parseInt(portMatch[1], 10);
    }
  }

  // Discover routes based on framework and directories
  profile.routes = discoverRoutes(targetDir, profile.framework);

  return profile;
}

function discoverRoutes(targetDir, framework) {
  const routes = [];

  // Universal base route
  routes.push({
    id: "home",
    name: "Home Landing Page",
    path: "/",
    weight: 0.4,
    checkKeywords: []
  });

  if (framework === "nextjs") {
    // Check for App Router or Pages Router
    const possibleAppDirs = [
      path.join(targetDir, "app"),
      path.join(targetDir, "src", "app"),
      path.join(targetDir, "apps", "web", "app"),
      path.join(targetDir, "apps", "web", "src", "app")
    ];

    const possiblePagesDirs = [
      path.join(targetDir, "pages"),
      path.join(targetDir, "src", "pages"),
      path.join(targetDir, "apps", "web", "pages")
    ];

    let foundApiHealth = false;

    // Check for API routes
    for (const d of [...possibleAppDirs, ...possiblePagesDirs]) {
      if (fs.existsSync(path.join(d, "api", "health")) || fs.existsSync(path.join(d, "api", "health.ts")) || fs.existsSync(path.join(d, "api", "health.js"))) {
        foundApiHealth = true;
        break;
      }
    }

    if (foundApiHealth) {
      routes.push({
        id: "api_health",
        name: "Health API",
        path: "/api/health",
        weight: 0.3,
        isJson: true
      });
    }

    // Check common Next.js public/app assets
    routes.push({
      id: "sitemap",
      name: "SEO Sitemap",
      path: "/sitemap.xml",
      weight: 0.15
    });

    routes.push({
      id: "robots",
      name: "SEO Robots",
      path: "/robots.txt",
      weight: 0.15
    });
  } else if (framework === "express-or-api") {
    routes.push({
      id: "api_health",
      name: "API Health Status",
      path: "/api/health",
      weight: 0.4,
      isJson: true
    });
    routes.push({
      id: "api_status",
      name: "API Status",
      path: "/health",
      weight: 0.2,
      isJson: true
    });
  } else {
    // Generic web application
    routes.push({
      id: "robots",
      name: "Robots",
      path: "/robots.txt",
      weight: 0.3
    });
    routes.push({
      id: "sitemap",
      name: "Sitemap",
      path: "/sitemap.xml",
      weight: 0.3
    });
  }

  return routes;
}

module.exports = {
  detectProject,
  discoverRoutes
};
