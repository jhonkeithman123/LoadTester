/**
 * Generates custom, adaptive loadTester.js for any target project
 */

const { generateGlossaryHtml } = require("./reporter-template");

function generateLoadTesterScript(profile) {
  const defaultBaseUrl = profile.liveUrl || `http://localhost:${profile.localPort}`;
  const glossarySnippet = JSON.stringify(generateGlossaryHtml());

  // Build the route groups
  let cumulativeWeight = 0;
  const routeBlocks = profile.routes.map((route, index) => {
    cumulativeWeight += route.weight;
    const isLast = index === profile.routes.length - 1;
    const condition = isLast ? "" : `if (rand < ${cumulativeWeight.toFixed(2)})`;
    const elsePrefix = index === 0 ? "" : "else ";

    return `  ${elsePrefix}${condition} {
    // ${route.name} (${Math.round(route.weight * 100)}% traffic)
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

// --- Project: ${profile.name} (Framework: ${profile.framework}) ---
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

module.exports = {
  generateLoadTesterScript
};
