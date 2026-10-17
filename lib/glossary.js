/**
 * Developer Metrics Glossary & Benchmark Guide for Load Testing
 * Explains all k6 metrics, percentiles, server behaviors, and common bottlenecks.
 */

const GLOSSARY_TERMS = [
  {
    category: "Latency & Speed",
    term: "http_req_duration",
    shortName: "Request Duration (Roundtrip Latency)",
    description: "The total elapsed time from when k6 initiates the HTTP request until the complete response body is received from the server.",
    formula: "http_req_sending + http_req_waiting + http_req_receiving",
    benchmark: "Target < 250ms for APIs; < 500ms for SSR HTML; < 50ms for cached assets.",
    troubleshooting: "If this exceeds 1-2s under load, your server is CPU/memory constrained or blocking on synchronous I/O or database queries."
  },
  {
    category: "Latency & Speed",
    term: "http_req_waiting (TTFB)",
    shortName: "Time To First Byte (Server Processing Time)",
    description: "The time spent waiting for the server to process the request and send the very first byte of response after the request was sent.",
    benchmark: "Target < 100ms for APIs and static routes; < 300ms for dynamic SSR pages.",
    troubleshooting: "High TTFB indicates backend computation delay, un-indexed DB queries, or running in development mode (e.g. 'next dev' on-demand compilation) instead of production ('next start')."
  },
  {
    category: "Latency & Speed",
    term: "p(90), p(95), p(99)",
    shortName: "Percentiles",
    description: "Statistical percentiles indicating the response time below which 90%, 95%, or 99% of all requests completed. Unlike averages, percentiles expose rare extreme latency spikes.",
    benchmark: "p(95) < 350ms, p(99) < 600ms for consumer-facing web applications.",
    troubleshooting: "Averages lie: 99 requests at 10ms and 1 request at 10,000ms averages to 109ms (looks fast), but p(99) is 10s. Always optimize for p(95) and p(99)."
  },
  {
    category: "Latency & Speed",
    term: "http_req_connecting",
    shortName: "TCP Connection Time",
    description: "The time required to establish a TCP 3-way handshake (SYN, SYN-ACK, ACK) with the remote server.",
    benchmark: "Target < 1ms on localhost; < 20-50ms over internet/CDN.",
    troubleshooting: "High connection times indicate network latency, DNS resolution bottlenecks, or server socket queue saturation (SYN backlog full)."
  },
  {
    category: "Latency & Speed",
    term: "http_req_blocked",
    shortName: "Blocked Time (Socket Acquisition)",
    description: "Time spent waiting for a free TCP connection from the connection pool before sending the request.",
    benchmark: "Target < 1ms.",
    troubleshooting: "High blocked time indicates the test runner machine has exhausted local TCP sockets or connection pool limits."
  },
  {
    category: "Concurrency & Load",
    term: "VUs (Virtual Users)",
    shortName: "Simulated Concurrent Clients",
    description: "Independent concurrent execution threads in k6. Each VU simulates a real human user executing scenarios in a continuous loop.",
    benchmark: "50 VUs with rapid looping can simulate the load of 5,000-10,000 daily active human users.",
    troubleshooting: "A single VU does not make just 1 request—it loops continuously. 50 VUs without sleep can generate 500+ requests per second."
  },
  {
    category: "Concurrency & Load",
    term: "iterations",
    shortName: "Scenario Cycles Completed",
    description: "The total number of full passes executed by all VUs through your test function from start to finish.",
    benchmark: "Higher iterations per minute = higher overall system throughput (RPS).",
    troubleshooting: "If iteration count drops sharply while VUs ramp up, the server is slowing down, causing each iteration to take longer."
  },
  {
    category: "Concurrency & Load",
    term: "iteration_duration",
    shortName: "Cycle Duration",
    description: "The time taken for a VU to complete one full pass through the default function, including all HTTP requests and sleep() pauses.",
    benchmark: "Should roughly equal (sum of request durations + configured sleep delays).",
    troubleshooting: "Sudden spikes in iteration_duration mean server response times have degraded."
  },
  {
    category: "Reliability & Resilience",
    term: "http_req_failed",
    shortName: "Failure & Error Rate",
    description: "The percentage of HTTP requests that returned error status codes (4xx, 5xx) or dropped TCP connections.",
    benchmark: "Target: 0.00% under normal load; < 1.00% under peak stress testing.",
    troubleshooting: "502 Bad Gateway: Reverse proxy (Nginx, Vercel) timed out waiting for backend. 504 Gateway Timeout: Server hung. 500 Internal Error: Uncaught exception or DB pool exhaustion."
  },
  {
    category: "Reliability & Resilience",
    term: "WAF Challenge / Edge Mitigation (403)",
    shortName: "Web Application Firewall Shield",
    description: "When an Edge network (Cloudflare, Vercel DDoS Protection, AWS Shield) flags high-volume test traffic as a bot attack, returning 403 Forbidden with 'x-vercel-mitigated: challenge' or captcha.",
    benchmark: "0% in production tests by configuring test bypass tokens or IP allowlists.",
    troubleshooting: "If live tests fail with 403, pass bypass headers (e.g. -e VERCEL_BYPASS_TOKEN=your-token) or configure a dedicated staging environment without aggressive WAF."
  },
  {
    category: "Architecture & Framework Gotchas",
    term: "Development Mode vs Production Mode",
    shortName: "Next.js / Node.js Dev Mode Pitfall",
    description: "Running load tests against local dev servers (e.g. 'next dev' or 'pnpm dev') instead of production builds ('next build && next start').",
    benchmark: "Localhost production build should respond in < 15ms.",
    troubleshooting: "CRITICAL: 'next dev' compiles TypeScript on every hit and disables in-memory caching. Under 50 VUs, dev servers freeze and show 6,000ms - 12,000ms latency. Always build and run 'next start' before testing!"
  },
  {
    category: "Architecture & Framework Gotchas",
    term: "Edge Cache Hits / Misses",
    shortName: "CDN Caching Efficiency",
    description: "Whether requests were served from Edge memory cache ('HIT' / 'STALE') or had to re-invoke the origin serverless function ('MISS').",
    benchmark: "> 90% cache hits for static assets, public landing pages, and sitemaps.",
    troubleshooting: "Add Cache-Control headers (e.g. 's-maxage=60, stale-while-revalidate=300') to static API responses to absorb heavy spikes."
  }
];

module.exports = {
  GLOSSARY_TERMS
};
