/**
 * Universal Architecture, Framework, and Route Detector
 * Inspects any project topology: Monorepos, Multi-Service / Polyglot architectures,
 * Containerized stacks, or Single-Service apps.
 */

const fs = require("fs");
const path = require("path");

/**
 * Loads user-defined custom architecture configuration if present.
 */
function loadCustomConfig(targetDir) {
  const configFiles = [
    "loadtester.config.js",
    "loadtester.config.json",
    "loadtester.config.cjs"
  ];

  for (const configFile of configFiles) {
    const fullPath = path.join(targetDir, configFile);
    if (fs.existsSync(fullPath)) {
      try {
        if (configFile.endsWith(".json")) {
          return JSON.parse(fs.readFileSync(fullPath, "utf8"));
        } else {
          delete require.cache[require.resolve(fullPath)];
          return require(fullPath);
        }
      } catch (err) {
        console.warn(`[LoadTester] Notice: Failed to load ${configFile}: ${err.message}`);
      }
    }
  }
  return null;
}

/**
 * Checks for Docker Compose configuration and extracts services and mapped host ports.
 */
function detectDockerComposeServices(targetDir) {
  const composeFiles = [
    "docker-compose.yml",
    "docker-compose.yaml",
    "compose.yml",
    "compose.yaml"
  ];

  for (const f of composeFiles) {
    const filePath = path.join(targetDir, f);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf8");
        const lines = content.split("\n");
        const services = [];
        let inServices = false;
        let currentService = null;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmed = line.trim();

          if (/^services:\s*$/.test(trimmed)) {
            inServices = true;
            continue;
          }

          if (inServices) {
            // Service declaration (indented with 2 spaces or tabs)
            const serviceMatch = line.match(/^(?: {2}|\t)([a-zA-Z0-9_-]+):\s*$/);
            if (serviceMatch && !line.startsWith("    ")) {
              currentService = {
                id: serviceMatch[1],
                name: serviceMatch[1],
                path: ".",
                fullPath: targetDir,
                framework: "docker-service",
                language: "container",
                localPort: 3000,
                liveUrl: "https://your-domain.vercel.app",
                routes: []
              };
              services.push(currentService);
              continue;
            }

            // Port mappings like "3000:3000" or - 8000:8000
            if (currentService) {
              const portMatch = line.match(/(?:-|ports:)?\s*["']?([0-9]{2,5}):([0-9]{2,5})["']?/);
              if (portMatch) {
                const hostPort = parseInt(portMatch[1], 10);
                if (hostPort > 0 && hostPort < 65536) {
                  currentService.localPort = hostPort;
                }
              }
            }
          }
        }

        if (services.length > 0) {
          services.forEach((s) => {
            s.routes = discoverRoutes(s.fullPath, s.framework, s.language);
          });
          return services;
        }
      } catch {
        // Fallback if parsing fails
      }
    }
  }
  return null;
}

/**
 * Parses pnpm-workspace.yaml package paths without requiring YAML dependency.
 */
function parsePnpmWorkspaces(targetDir) {
  const pnpmPath = path.join(targetDir, "pnpm-workspace.yaml");
  if (!fs.existsSync(pnpmPath)) return [];

  const packages = [];
  try {
    const content = fs.readFileSync(pnpmPath, "utf8");
    const lines = content.split("\n");
    let inPackages = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^packages:\s*$/.test(trimmed)) {
        inPackages = true;
        continue;
      }
      if (inPackages) {
        if (/^[a-zA-Z0-9_-]+:/.test(trimmed) && !trimmed.startsWith("-")) {
          break;
        }
        const match = trimmed.match(/^-\s*["']?([^"']+)["']?/);
        if (match) {
          packages.push(match[1]);
        }
      }
    }
  } catch {
    // Ignore error
  }
  return packages;
}

/**
 * Inspects a specific directory to detect its framework, language, and default port.
 */
function inspectDirectoryService(serviceDir, rootDir) {
  const relativePath = path.relative(rootDir, serviceDir) || ".";
  const baseName = path.basename(serviceDir);

  const profile = {
    id: baseName.toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
    name: baseName,
    path: relativePath,
    fullPath: serviceDir,
    framework: "generic",
    language: "generic",
    localPort: 3000,
    liveUrl: "https://your-domain.vercel.app",
    routes: [],
    packageJsonPath: null
  };

  // 1. Check Node.js / JavaScript / TypeScript package.json
  const pkgPath = path.join(serviceDir, "package.json");
  let pkg = null;
  if (fs.existsSync(pkgPath)) {
    profile.packageJsonPath = pkgPath;
    profile.language = "nodejs";
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.name) profile.name = pkg.name;
    } catch {
      // Ignore parse error
    }
  }

  const allDeps = pkg
    ? {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
        ...(pkg.peerDependencies || {})
      }
    : {};

  // Check custom script ports in package.json
  let explicitPort = null;
  if (pkg && pkg.scripts) {
    const devScript = pkg.scripts.dev || pkg.scripts.start || pkg.scripts.serve || "";
    const portMatch = devScript.match(/(?:-p|--port|PORT=)\s*([0-9]{3,5})/i);
    if (portMatch) {
      explicitPort = parseInt(portMatch[1], 10);
      profile.localPort = explicitPort;
    }
  }

  // Node Framework Detection
  if (
    allDeps.next ||
    fs.existsSync(path.join(serviceDir, "next.config.js")) ||
    fs.existsSync(path.join(serviceDir, "next.config.mjs")) ||
    fs.existsSync(path.join(serviceDir, "next.config.ts"))
  ) {
    profile.framework = "nextjs";
    profile.localPort = explicitPort || 3000;
  } else if (
    allDeps.nuxt ||
    fs.existsSync(path.join(serviceDir, "nuxt.config.js")) ||
    fs.existsSync(path.join(serviceDir, "nuxt.config.ts"))
  ) {
    profile.framework = "nuxt";
    profile.localPort = explicitPort || 3000;
  } else if (
    allDeps["@sveltejs/kit"] ||
    fs.existsSync(path.join(serviceDir, "svelte.config.js"))
  ) {
    profile.framework = "sveltekit";
    profile.localPort = explicitPort || 5173;
  } else if (
    allDeps["@remix-run/react"] ||
    fs.existsSync(path.join(serviceDir, "remix.config.js"))
  ) {
    profile.framework = "remix";
    profile.localPort = explicitPort || 3000;
  } else if (
    allDeps.vite ||
    fs.existsSync(path.join(serviceDir, "vite.config.js")) ||
    fs.existsSync(path.join(serviceDir, "vite.config.ts"))
  ) {
    profile.framework = "vite";
    profile.localPort = explicitPort || 5173;
  } else if (
    allDeps.astro ||
    fs.existsSync(path.join(serviceDir, "astro.config.mjs"))
  ) {
    profile.framework = "astro";
    profile.localPort = explicitPort || 4321;
  } else if (
    allDeps["@angular/core"] ||
    fs.existsSync(path.join(serviceDir, "angular.json"))
  ) {
    profile.framework = "angular";
    profile.localPort = explicitPort || 4200;
  } else if (allDeps["@nestjs/core"]) {
    profile.framework = "nestjs";
    profile.localPort = explicitPort || 3000;
  } else if (allDeps.fastify) {
    profile.framework = "fastify";
    profile.localPort = explicitPort || 3000;
  } else if (allDeps.hono) {
    profile.framework = "hono";
    profile.localPort = explicitPort || 3000;
  } else if (allDeps.express || allDeps.koa) {
    profile.framework = "express-or-api";
    profile.localPort = explicitPort || 3000;
  }

  // 2. Python Detection (FastAPI, Flask, Django, Litestar, etc.)
  const pyprojectPath = path.join(serviceDir, "pyproject.toml");
  const requirementsPath = path.join(serviceDir, "requirements.txt");
  const pipfilePath = path.join(serviceDir, "Pipfile");
  const managePyPath = path.join(serviceDir, "manage.py");

  const hasPythonIndicators =
    fs.existsSync(pyprojectPath) ||
    fs.existsSync(requirementsPath) ||
    fs.existsSync(pipfilePath) ||
    fs.existsSync(managePyPath) ||
    fs.existsSync(path.join(serviceDir, "main.py")) ||
    fs.existsSync(path.join(serviceDir, "app.py"));

  if (hasPythonIndicators && profile.framework === "generic") {
    profile.language = "python";
    let pyContent = "";
    if (fs.existsSync(pyprojectPath)) pyContent += fs.readFileSync(pyprojectPath, "utf8");
    if (fs.existsSync(requirementsPath)) pyContent += fs.readFileSync(requirementsPath, "utf8");
    if (fs.existsSync(pipfilePath)) pyContent += fs.readFileSync(pipfilePath, "utf8");

    const lowerPy = pyContent.toLowerCase();
    if (lowerPy.includes("fastapi")) {
      profile.framework = "fastapi";
      profile.localPort = explicitPort || 8000;
    } else if (lowerPy.includes("flask")) {
      profile.framework = "flask";
      profile.localPort = explicitPort || 5000;
    } else if (lowerPy.includes("django") || fs.existsSync(managePyPath)) {
      profile.framework = "django";
      profile.localPort = explicitPort || 8000;
    } else if (lowerPy.includes("litestar") || lowerPy.includes("sanic") || lowerPy.includes("tornado")) {
      profile.framework = "python-api";
      profile.localPort = explicitPort || 8000;
    } else {
      profile.framework = "python-service";
      profile.localPort = explicitPort || 8000;
    }
  }

  // 3. Go Detection (Gin, Echo, Fiber, Chi, standard net/http)
  const goModPath = path.join(serviceDir, "go.mod");
  if (fs.existsSync(goModPath) && profile.framework === "generic") {
    profile.language = "go";
    try {
      const goMod = fs.readFileSync(goModPath, "utf8");
      if (goMod.includes("github.com/gin-gonic/gin")) {
        profile.framework = "go-gin";
      } else if (goMod.includes("github.com/labstack/echo")) {
        profile.framework = "go-echo";
      } else if (goMod.includes("github.com/gofiber/fiber")) {
        profile.framework = "go-fiber";
      } else {
        profile.framework = "go-service";
      }
      profile.localPort = 8080;
    } catch {
      profile.framework = "go-service";
      profile.localPort = 8080;
    }
  }

  // 4. Rust Detection (Axum, Actix-web, Rocket)
  const cargoPath = path.join(serviceDir, "Cargo.toml");
  if (fs.existsSync(cargoPath) && profile.framework === "generic") {
    profile.language = "rust";
    try {
      const cargo = fs.readFileSync(cargoPath, "utf8");
      if (cargo.includes("axum")) {
        profile.framework = "rust-axum";
      } else if (cargo.includes("actix-web")) {
        profile.framework = "rust-actix";
      } else {
        profile.framework = "rust-service";
      }
      profile.localPort = 8080;
    } catch {
      profile.framework = "rust-service";
      profile.localPort = 8080;
    }
  }

  // 5. PHP Detection (Laravel, Symfony)
  const composerPath = path.join(serviceDir, "composer.json");
  if (fs.existsSync(composerPath) && profile.framework === "generic") {
    profile.language = "php";
    try {
      const comp = fs.readFileSync(composerPath, "utf8");
      if (comp.includes("laravel/framework") || fs.existsSync(path.join(serviceDir, "artisan"))) {
        profile.framework = "laravel";
      } else {
        profile.framework = "php-service";
      }
      profile.localPort = 8000;
    } catch {
      profile.framework = "php-service";
      profile.localPort = 8000;
    }
  }

  // 6. Ruby Detection (Rails, Sinatra)
  const gemfilePath = path.join(serviceDir, "Gemfile");
  if (fs.existsSync(gemfilePath) && profile.framework === "generic") {
    profile.language = "ruby";
    try {
      const gemfile = fs.readFileSync(gemfilePath, "utf8");
      if (gemfile.includes("rails")) {
        profile.framework = "rails";
      } else {
        profile.framework = "ruby-service";
      }
      profile.localPort = 3000;
    } catch {
      profile.framework = "ruby-service";
      profile.localPort = 3000;
    }
  }

  // Discover routes for this specific service
  profile.routes = discoverRoutes(serviceDir, profile.framework, profile.language);

  return profile;
}

/**
 * Discovers sub-services by resolving directories according to workspace patterns or folder conventions.
 */
function scanWorkspaceServices(targetDir) {
  const discoveredServices = [];
  const scannedPaths = new Set();

  function considerDirectory(dir) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
    const resolved = path.resolve(dir);
    if (scannedPaths.has(resolved) || resolved === path.resolve(targetDir)) return;

    // Skip node_modules, git, dist, build, test caches
    const base = path.basename(resolved);
    if (base === "node_modules" || base === ".git" || base === "dist" || base === "build" || base === ".next" || base.startsWith(".")) {
      return;
    }

    // A valid service typically has package.json, pyproject.toml, requirements.txt, go.mod, Cargo.toml, or composer.json
    const isServiceRoot =
      fs.existsSync(path.join(resolved, "package.json")) ||
      fs.existsSync(path.join(resolved, "pyproject.toml")) ||
      fs.existsSync(path.join(resolved, "requirements.txt")) ||
      fs.existsSync(path.join(resolved, "go.mod")) ||
      fs.existsSync(path.join(resolved, "Cargo.toml")) ||
      fs.existsSync(path.join(resolved, "composer.json")) ||
      fs.existsSync(path.join(resolved, "app")) ||
      fs.existsSync(path.join(resolved, "src"));

    if (isServiceRoot) {
      scannedPaths.add(resolved);
      const serviceProfile = inspectDirectoryService(resolved, targetDir);
      discoveredServices.push(serviceProfile);
    }
  }

  // Check explicit package.json workspaces
  const rootPkgPath = path.join(targetDir, "package.json");
  if (fs.existsSync(rootPkgPath)) {
    try {
      const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
      const workspaces = Array.isArray(rootPkg.workspaces)
        ? rootPkg.workspaces
        : (rootPkg.workspaces && rootPkg.workspaces.packages) || [];

      for (const pattern of workspaces) {
        if (pattern.endsWith("/*")) {
          const parentDir = path.join(targetDir, pattern.slice(0, -2));
          if (fs.existsSync(parentDir)) {
            const children = fs.readdirSync(parentDir);
            for (const child of children) {
              considerDirectory(path.join(parentDir, child));
            }
          }
        } else {
          considerDirectory(path.join(targetDir, pattern));
        }
      }
    } catch {
      // Ignore
    }
  }

  // Check pnpm workspaces
  const pnpmGlobs = parsePnpmWorkspaces(targetDir);
  for (const pattern of pnpmGlobs) {
    if (pattern.endsWith("/*")) {
      const parentDir = path.join(targetDir, pattern.slice(0, -2));
      if (fs.existsSync(parentDir)) {
        const children = fs.readdirSync(parentDir);
        for (const child of children) {
          considerDirectory(path.join(parentDir, child));
        }
      }
    } else {
      considerDirectory(path.join(targetDir, pattern));
    }
  }

  // Standard monorepo & multi-tier directory conventions
  const conventionDirs = [
    "apps",
    "packages",
    "services",
    "modules",
    "projects",
    "backend",
    "frontend",
    "server",
    "client",
    "api",
    "web",
    "ui"
  ];

  for (const dirName of conventionDirs) {
    const candidate = path.join(targetDir, dirName);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      // If candidate itself is a service root (e.g. backend/ or frontend/)
      const hasDirectMarkers =
        fs.existsSync(path.join(candidate, "package.json")) ||
        fs.existsSync(path.join(candidate, "requirements.txt")) ||
        fs.existsSync(path.join(candidate, "pyproject.toml")) ||
        fs.existsSync(path.join(candidate, "go.mod"));

      if (hasDirectMarkers) {
        considerDirectory(candidate);
      } else {
        // Or if it's a folder holding apps (e.g. apps/web, apps/docs)
        const subItems = fs.readdirSync(candidate);
        for (const sub of subItems) {
          considerDirectory(path.join(candidate, sub));
        }
      }
    }
  }

  return discoveredServices;
}

/**
 * Universal Project Detector
 * Evaluates target directory, discovers all services, and produces an adaptive architecture profile.
 */
function detectProject(targetDir = process.cwd(), options = {}) {
  // Check custom config first
  const customConfig = loadCustomConfig(targetDir);

  const profile = {
    targetDir,
    architecture: "single-service",
    workspaceType: "none",
    name: path.basename(targetDir),
    framework: "generic",
    language: "generic",
    localPort: 3000,
    liveUrl: "https://your-domain.vercel.app",
    isMonorepo: false,
    services: [],
    selectedService: null,
    routes: [],
    packageJsonPath: null,
    hasGitignore: false
  };

  if (fs.existsSync(path.join(targetDir, ".gitignore"))) {
    profile.hasGitignore = true;
  }

  // Monorepo signatures
  const hasTurbo = fs.existsSync(path.join(targetDir, "turbo.json"));
  const hasPnpmWorkspace = fs.existsSync(path.join(targetDir, "pnpm-workspace.yaml"));
  const hasNx = fs.existsSync(path.join(targetDir, "nx.json"));
  const hasLerna = fs.existsSync(path.join(targetDir, "lerna.json"));
  const hasBunLock = fs.existsSync(path.join(targetDir, "bun.lockb")) || fs.existsSync(path.join(targetDir, "bunfig.toml"));

  const rootPkgPath = path.join(targetDir, "package.json");
  let rootPkg = null;
  if (fs.existsSync(rootPkgPath)) {
    profile.packageJsonPath = rootPkgPath;
    try {
      rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, "utf8"));
      if (rootPkg.name) profile.name = rootPkg.name;
    } catch {
      // Ignore
    }
  }

  const hasNpmWorkspaces = rootPkg && Boolean(rootPkg.workspaces);

  if (hasTurbo || hasPnpmWorkspace || hasNx || hasLerna || hasNpmWorkspaces || hasBunLock) {
    profile.isMonorepo = true;
    profile.architecture = "monorepo";
    if (hasTurbo) profile.workspaceType = "turborepo";
    else if (hasPnpmWorkspace) profile.workspaceType = "pnpm";
    else if (hasNx) profile.workspaceType = "nx";
    else if (hasLerna) profile.workspaceType = "lerna";
    else if (hasBunLock) profile.workspaceType = "bun";
    else if (hasNpmWorkspaces) profile.workspaceType = "npm-workspaces";
  }

  // Apply custom config if defined
  if (customConfig && customConfig.services && Array.isArray(customConfig.services)) {
    profile.architecture = customConfig.architecture || "custom";
    profile.services = customConfig.services.map((s, idx) => ({
      id: s.id || s.name || `service-${idx + 1}`,
      name: s.name || `Service ${idx + 1}`,
      path: s.path || ".",
      fullPath: path.resolve(targetDir, s.path || "."),
      framework: s.framework || "generic",
      language: s.language || "generic",
      localPort: s.port || s.localPort || 3000,
      liveUrl: s.liveUrl || profile.liveUrl,
      routes: s.routes || discoverRoutes(path.resolve(targetDir, s.path || "."), s.framework || "generic")
    }));
  } else {
    // Check Docker Compose
    const dockerServices = detectDockerComposeServices(targetDir);

    // Scan sub-services across workspace / folders
    const workspaceServices = scanWorkspaceServices(targetDir);

    if (workspaceServices.length > 0) {
      profile.services = workspaceServices;
      if (!profile.isMonorepo) {
        // Multi-service / polyglot architecture (e.g. backend/ + frontend/)
        profile.architecture = "multi-service";
        profile.workspaceType = "polyglot";
      }
    } else if (dockerServices && dockerServices.length > 0) {
      profile.services = dockerServices;
      profile.architecture = "containerized";
      profile.workspaceType = "docker-compose";
    } else {
      // Single-service root inspection
      const rootService = inspectDirectoryService(targetDir, targetDir);
      profile.services = [rootService];
      profile.framework = rootService.framework;
      profile.language = rootService.language;
      profile.localPort = rootService.localPort;
      profile.routes = rootService.routes;
    }
  }

  // Handle selected app if requested via options or CLI
  const requestedApp = options.app || null;
  if (requestedApp && profile.services.length > 0) {
    const match = profile.services.find(
      (s) =>
        s.id.toLowerCase() === requestedApp.toLowerCase() ||
        s.name.toLowerCase() === requestedApp.toLowerCase() ||
        path.basename(s.path).toLowerCase() === requestedApp.toLowerCase()
    );
    if (match) {
      profile.selectedService = match;
      profile.framework = match.framework;
      profile.language = match.language;
      profile.localPort = match.localPort;
      profile.routes = match.routes;
    }
  }

  // Default primary service reflection for backwards compatibility
  if (!profile.selectedService && profile.services.length > 0) {
    // Pick web/frontend if available, otherwise first service
    const primary =
      profile.services.find((s) => s.id.includes("web") || s.id.includes("frontend") || s.id.includes("client") || s.id.includes("app")) ||
      profile.services[0];
    profile.selectedService = primary;
    profile.framework = primary.framework;
    profile.language = primary.language;
    profile.localPort = primary.localPort;
    profile.routes = primary.routes;
  }

  return profile;
}

/**
 * Universal Route and Endpoint Discovery
 */
function discoverRoutes(targetDir, framework = "generic", language = "generic") {
  const routes = [];

  // Universal base route
  routes.push({
    id: "home",
    name: "Home Landing Page",
    path: "/",
    weight: 0.4,
    checkKeywords: []
  });

  // Next.js (App & Pages Router)
  if (framework === "nextjs") {
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
    for (const d of [...possibleAppDirs, ...possiblePagesDirs]) {
      if (
        fs.existsSync(path.join(d, "api", "health")) ||
        fs.existsSync(path.join(d, "api", "health.ts")) ||
        fs.existsSync(path.join(d, "api", "health.js")) ||
        fs.existsSync(path.join(d, "api", "health", "route.ts")) ||
        fs.existsSync(path.join(d, "api", "health", "route.js"))
      ) {
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
  } else if (
    framework === "fastapi" ||
    framework === "flask" ||
    framework === "django" ||
    framework === "python-api" ||
    framework === "python-service"
  ) {
    // Python APIs
    routes.push({
      id: "api_health",
      name: "API Health",
      path: "/health",
      weight: 0.35,
      isJson: true
    });

    if (framework === "fastapi") {
      routes.push({
        id: "openapi_docs",
        name: "OpenAPI Documentation",
        path: "/docs",
        weight: 0.15
      });
      routes.push({
        id: "openapi_schema",
        name: "OpenAPI JSON Schema",
        path: "/openapi.json",
        weight: 0.1,
        isJson: true
      });
    }
  } else if (
    framework.startsWith("go-") ||
    framework.startsWith("rust-") ||
    framework === "nestjs" ||
    framework === "fastify" ||
    framework === "hono" ||
    framework === "express-or-api"
  ) {
    // Microservices / APIs
    routes.push({
      id: "api_health",
      name: "API Health Status",
      path: "/health",
      weight: 0.35,
      isJson: true
    });
    routes.push({
      id: "api_status",
      name: "API Status",
      path: "/api/health",
      weight: 0.25,
      isJson: true
    });
  } else {
    // Generic Web Application / Single Page Application
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
  discoverRoutes,
  loadCustomConfig,
  inspectDirectoryService,
  scanWorkspaceServices
};
