/**
 * Generates custom, adaptive loadTester.js for any target project or multi-service architecture.
 */

const { generateGlossaryHtml } = require("./reporter-template");

/**
 * Generates single-service load test script.
 */
function generateSingleServiceScript(service, globalProfile = {}) {
  const defaultBaseUrl = service.liveUrl || `http://localhost:${service.localPort}`;
  const glossarySnippet = JSON.stringify(generateGlossaryHtml());
  const serviceName = service.name || globalProfile.name || "App";
  const framework = service.framework || "generic";

  // Build route groups
  let cumulativeWeight = 0;
  const routes = service.routes && service.routes.length > 0 ? service.routes : [
    { id: "home", name: "Home Landing Page", path: "/", weight: 1.0 }
  ];

  const totalWeight = routes.reduce((acc, r) => acc + (r.weight || 0.1), 0);
  const normalizedRoutes = routes.map((r) => ({
    ...r,
    normWeight: (r.weight || 0.1) / totalWeight
  }));

  const routeBlocks = normalizedRoutes.map((route, index) => {
    cumulativeWeight += route.normWeight;
    const isLast = index === normalizedRoutes.length - 1;
    const condition = isLast ? "" : `if (rand < ${cumulativeWeight.toFixed(2)})`;
    const elsePrefix = index === 0 ? "" : "else ";

    return `  ${elsePrefix}${condition} {
    // ${route.name} (~${Math.round(route.normWeight * 100)}% traffic)
    group("${route.name}", () => {
      const res = http.get(\`\${BASE_URL}${route.path}\`, { headers });
      ${route.isJson ? 'apiDuration.add(res.timings.duration);' : 'pageDuration.add(res.timings.duration);'}

      // Check for Edge WAF / Bot challenge
      const isChallenged = (res.headers["X-Vercel-Mitigated"] || res.headers["x-vercel-mitigated"] || "") === "challenge";
      if (isChallenged) {
        wafChallenges.add(1);
      }

      check(res, {
        "${route.id} status is 200": (r) => r.status === 200,
        "not challenged by WAF": () => !isChallenged,
        "latency < 500ms": (r) => r.timings.duration < 500,
      });
    });
  }`;
  }).join("\n");

  return `import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter } from "k6/metrics";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

// --- Service: ${serviceName} (Framework: ${framework}, Port: ${service.localPort}) ---
// --- Custom Metrics for In-Depth Observability ---
const pageDuration = new Trend("page_duration_ms");
const apiDuration = new Trend("api_duration_ms");
const wafChallenges = new Counter("waf_challenges");

// Target URL configurable via -e TARGET_URL=...
const BASE_URL = __ENV.TARGET_URL || "${defaultBaseUrl}";
const VERCEL_BYPASS_TOKEN = __ENV.VERCEL_BYPASS_TOKEN || "";

export const options = {
  stages: [
    { duration: "10s", target: 10 }, // Stage 1: Warm-up & baseline (10 VUs)
    { duration: "30s", target: 50 }, // Stage 2: Heavy traffic surge (50 VUs)
    { duration: "30s", target: 100 }, // Stage 3: Overload endurance stress (100 VUs)
    { duration: "10s", target: 0 },  // Stage 4: Ramp-down and recovery verification
  ],
  thresholds: {
    // 95% of all requests must complete within 400ms, 99% within 750ms
    http_req_duration: ["p(95)<400", "p(99)<750"],
    // Error rate must stay below 1%
    http_req_failed: ["rate<0.01"],
    // Page durations should stay below 500ms
    page_duration_ms: ["p(95)<500"],
  },
};

export default function () {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (LoadTester-Kit)",
    "Accept": "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
  };

  if (VERCEL_BYPASS_TOKEN) {
    headers["x-vercel-protection-bypass"] = VERCEL_BYPASS_TOKEN;
  }

  const rand = Math.random();

${routeBlocks}

  // Realistic human thinking time jitter between requests (200ms - 600ms)
  sleep(0.2 + Math.random() * 0.4);
}

// Injected Glossary and Reporter Hook
const GLOSSARY_HTML = ${glossarySnippet};

export function handleSummary(data) {
  let html = htmlReport(data);

  // Embed the interactive developer metrics glossary into the HTML report
  if (html.includes("</body>")) {
    html = html.replace("</body>", GLOSSARY_HTML + "</body>");
  } else {
    html = html + GLOSSARY_HTML;
  }

  return {
    "summary.html": html,
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
`;
}

/**
 * Generates unified multi-service load test script.
 * Distributes traffic across all services in the monorepo/architecture simultaneously.
 */
function generateMultiServiceScript(profile) {
  const glossarySnippet = JSON.stringify(generateGlossaryHtml());
  const services = profile.services || [];

  // Setup service config definitions
  const serviceDefs = services.map((s) => {
    const varName = s.id.toUpperCase().replace(/[^A-Z0-9]/g, "_") + "_URL";
    const defaultUrl = s.liveUrl || `http://localhost:${s.localPort}`;
    const trendVar = `${s.id.replace(/[^a-zA-Z0-9]/g, "_")}_duration`;
    return {
      service: s,
      varName,
      defaultUrl,
      trendVar
    };
  });

  const urlDeclarations = serviceDefs.map(
    (d) => `const ${d.varName} = __ENV.${d.varName} || "${d.defaultUrl}";`
  ).join("\n");

  const trendDeclarations = serviceDefs.map(
    (d) => `const ${d.trendVar} = new Trend("${d.service.id}_duration_ms");`
  ).join("\n");

  // Create unified routing blocks
  const serviceBlocks = serviceDefs.map((def, sIdx) => {
    const s = def.service;
    const routes = s.routes && s.routes.length > 0 ? s.routes : [
      { id: "root", name: `${s.name} Home`, path: "/", weight: 1.0 }
    ];

    const innerBlocks = routes.map((r) => {
      return `    group("${s.name} - ${r.name}", () => {
      const res = http.get(\`\${${def.varName}}${r.path}\`, { headers });
      ${def.trendVar}.add(res.timings.duration);

      const isChallenged = (res.headers["X-Vercel-Mitigated"] || res.headers["x-vercel-mitigated"] || "") === "challenge";
      if (isChallenged) wafChallenges.add(1);

      check(res, {
        "${s.id}_${r.id} status is 200": (r) => r.status === 200,
        "${s.id} healthy latency < 500ms": (r) => r.timings.duration < 500,
      });
    });`;
    }).join("\n");

    const isLast = sIdx === serviceDefs.length - 1;
    const share = (1 / serviceDefs.length).toFixed(2);
    const cumulative = ((sIdx + 1) / serviceDefs.length).toFixed(2);
    const condition = isLast ? "" : `if (svcRand < ${cumulative})`;
    const elsePrefix = sIdx === 0 ? "" : "else ";

    return `  ${elsePrefix}${condition} {
    // Service: ${s.name} (${s.framework}, port ${s.localPort})
${innerBlocks}
  }`;
  }).join("\n");

  return `import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter } from "k6/metrics";
import { htmlReport } from "https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js";
import { textSummary } from "https://jslib.k6.io/k6-summary/0.0.2/index.js";

// --- Multi-Service Architecture Load Testing Suite ---
// --- Architecture: ${profile.architecture.toUpperCase()} (Detected Services: ${services.length}) ---

${urlDeclarations}
const VERCEL_BYPASS_TOKEN = __ENV.VERCEL_BYPASS_TOKEN || "";

// Custom Metrics Per Service
${trendDeclarations}
const wafChallenges = new Counter("waf_challenges");

export const options = {
  stages: [
    { duration: "10s", target: 10 }, // Stage 1: Warm-up & baseline (10 VUs)
    { duration: "30s", target: 50 }, // Stage 2: Heavy multi-service traffic surge (50 VUs)
    { duration: "30s", target: 100 }, // Stage 3: Overload endurance stress (100 VUs)
    { duration: "10s", target: 0 },  // Stage 4: Ramp-down and recovery verification
  ],
  thresholds: {
    http_req_duration: ["p(95)<450", "p(99)<800"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (LoadTester-Kit Multi-Service)",
    "Accept": "text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8",
  };

  if (VERCEL_BYPASS_TOKEN) {
    headers["x-vercel-protection-bypass"] = VERCEL_BYPASS_TOKEN;
  }

  const svcRand = Math.random();

${serviceBlocks}

  // Realistic human thinking jitter between requests
  sleep(0.2 + Math.random() * 0.4);
}

// Injected Glossary and Reporter Hook
const GLOSSARY_HTML = ${glossarySnippet};

export function handleSummary(data) {
  let html = htmlReport(data);

  if (html.includes("</body>")) {
    html = html.replace("</body>", GLOSSARY_HTML + "</body>");
  } else {
    html = html + GLOSSARY_HTML;
  }

  return {
    "summary.html": html,
    stdout: textSummary(data, { indent: " ", enableColors: true }),
  };
}
`;
}

/**
 * Main export: generates adaptive test script based on profile and options.
 */
function generateLoadTesterScript(profile, options = {}) {
  const isMulti = options.all || (
    profile.services &&
    profile.services.length > 1 &&
    !options.app &&
    !profile.selectedService
  );

  if (isMulti) {
    return generateMultiServiceScript(profile);
  }

  // Single service target
  const service = profile.selectedService || (profile.services && profile.services[0]) || {
    name: profile.name,
    framework: profile.framework,
    localPort: profile.localPort,
    liveUrl: profile.liveUrl,
    routes: profile.routes
  };

  return generateSingleServiceScript(service, profile);
}

module.exports = {
  generateLoadTesterScript,
  generateSingleServiceScript,
  generateMultiServiceScript
};
