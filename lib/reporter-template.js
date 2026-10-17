/**
 * Injects an Interactive Developer Metrics Glossary & Benchmark Guide into k6-reporter summary.html
 */

const { GLOSSARY_TERMS } = require("./glossary");

function generateGlossaryHtml() {
  const categories = [...new Set(GLOSSARY_TERMS.map((t) => t.category))];

  return `
<!-- LoadTester Developer Metrics Glossary & Benchmark Guide -->
<style>
  #lt-glossary-container {
    margin: 40px auto 60px auto;
    max-width: 1200px;
    padding: 0 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .lt-card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 14px;
    box-shadow: 0 20px 35px -10px rgba(0, 0, 0, 0.5);
    overflow: hidden;
    color: #f8fafc;
  }
  .lt-header {
    background: linear-gradient(135deg, #0284c7 0%, #2563eb 100%);
    padding: 22px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    cursor: pointer;
    user-select: none;
  }
  .lt-header:hover {
    background: linear-gradient(135deg, #0369a1 0%, #1d4ed8 100%);
  }
  .lt-header-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .lt-header h2 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #ffffff;
  }
  .lt-header-badge {
    background: rgba(255, 255, 255, 0.2);
    padding: 4px 10px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .lt-toggle-arrow {
    font-size: 1.2rem;
    transition: transform 0.2s ease;
  }
  .lt-toggle-arrow.open {
    transform: rotate(180deg);
  }
  .lt-diagnostic-alert {
    display: none;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid #ef4444;
    border-radius: 10px;
    padding: 16px 20px;
    margin: 20px 28px 0 28px;
    color: #fecaca;
  }
  .lt-diagnostic-alert h4 {
    margin: 0 0 6px 0;
    font-size: 1rem;
    font-weight: 700;
    color: #f87171;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .lt-diagnostic-alert p {
    margin: 0;
    font-size: 0.88rem;
    line-height: 1.5;
    color: #e2e8f0;
  }
  .lt-controls {
    padding: 20px 28px 0 28px;
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    align-items: center;
    justify-content: space-between;
  }
  .lt-filter-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .lt-pill {
    background: #1e293b;
    border: 1px solid #334155;
    color: #94a3b8;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .lt-pill.active, .lt-pill:hover {
    background: #0284c7;
    color: #ffffff;
    border-color: #38bdf8;
  }
  .lt-search-box {
    padding: 8px 14px;
    border-radius: 8px;
    border: 1px solid #334155;
    background: #1e293b;
    color: #ffffff;
    font-size: 0.88rem;
    outline: none;
    min-width: 240px;
  }
  .lt-search-box:focus {
    border-color: #38bdf8;
  }
  .lt-content {
    padding: 20px 28px 28px 28px;
  }
  .lt-category-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #38bdf8;
    margin: 24px 0 14px 0;
    border-bottom: 1px solid #1e293b;
    padding-bottom: 8px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .lt-category-title:first-child {
    margin-top: 0;
  }
  .lt-term-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 16px;
  }
  .lt-term-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
    padding: 16px 18px;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }
  .lt-term-card:hover {
    transform: translateY(-2px);
    border-color: #38bdf8;
  }
  .lt-term-name {
    font-size: 1rem;
    font-weight: 700;
    color: #e2e8f0;
    margin-bottom: 4px;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .lt-term-code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 0.8rem;
    background: #0f172a;
    color: #38bdf8;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .lt-term-desc {
    color: #94a3b8;
    font-size: 0.88rem;
    line-height: 1.5;
    margin: 8px 0;
  }
  .lt-term-meta {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed #334155;
    font-size: 0.82rem;
  }
  .lt-meta-badge {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-weight: 600;
    margin-bottom: 6px;
    font-size: 0.75rem;
    background: rgba(16, 185, 129, 0.2);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.4);
  }
  .lt-troubleshooting {
    color: #f59e0b;
    background: rgba(245, 158, 11, 0.1);
    border-left: 3px solid #f59e0b;
    padding: 6px 10px;
    border-radius: 0 4px 4px 0;
    margin-top: 8px;
    line-height: 1.4;
  }
  .lt-footer-banner {
    background: #0b1120;
    border-top: 1px solid #1e293b;
    padding: 16px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.82rem;
    color: #64748b;
  }
  .lt-footer-banner a {
    color: #38bdf8;
    text-decoration: none;
  }
</style>

<div id="lt-glossary-container">
  <div class="lt-card">
    <div class="lt-header" onclick="toggleGlossary()">
      <div class="lt-header-left">
        <h2><span>📖</span> Developer Metrics Glossary & Benchmark Guide</h2>
        <span class="lt-header-badge">LoadTester Kit</span>
      </div>
      <div class="lt-toggle-arrow open" id="lt-arrow">▼</div>
    </div>

    <!-- Diagnostic Banner: Auto-detects high latency on localhost -->
    <div class="lt-diagnostic-alert" id="lt-diag-alert">
      <h4><span>⚠️</span> High Localhost Latency Detected (> 1.5s)</h4>
      <p>
        Your local server took over 1.5 seconds per request. If this is a <strong>Next.js</strong> or <strong>Node</strong> app, verify whether you are running in <strong>Development Mode</strong> (<code>next dev</code> / <code>pnpm dev</code>). In development mode, Next.js compiles TypeScript on every hit. <strong>Always test against a production build (<code>pnpm build && pnpm start</code>)</strong> for accurate &lt; 20ms benchmarks.
      </p>
    </div>

    <div id="lt-body-section">
      <div class="lt-controls">
        <div class="lt-filter-pills">
          <button class="lt-pill active" onclick="setCategoryFilter('all', this)">All Metrics</button>
          ${categories
            .map(
              (cat) => `<button class="lt-pill" onclick="setCategoryFilter('${cat}', this)">${cat}</button>`
            )
            .join("")}
        </div>
        <input 
          type="text" 
          id="lt-search" 
          class="lt-search-box" 
          placeholder="Filter metrics (e.g. TTFB, p95)..." 
          onkeyup="filterGlossary()"
        />
      </div>

      <div class="lt-content" id="lt-terms-wrapper">
        ${categories
          .map(
            (cat) => `
          <div class="lt-category-group" data-category="${cat}">
            <div class="lt-category-title">
              <span>🔹</span> ${cat}
            </div>
            <div class="lt-term-grid">
              ${GLOSSARY_TERMS.filter((t) => t.category === cat)
                .map(
                  (t) => `
                <div class="lt-term-card" data-term="${t.term.toLowerCase()} ${t.shortName.toLowerCase()} ${t.description.toLowerCase()}">
                  <div class="lt-term-name">
                    <span>${t.shortName}</span>
                    <span class="lt-term-code">${t.term}</span>
                  </div>
                  <div class="lt-term-desc">${t.description}</div>
                  <div class="lt-term-meta">
                    ${
                      t.benchmark
                        ? `<div><span class="lt-meta-badge">Target</span> <span style="color: #cbd5e1">${t.benchmark}</span></div>`
                        : ""
                    }
                    ${
                      t.troubleshooting
                        ? `<div class="lt-troubleshooting"><strong>💡 Diagnostic:</strong> ${t.troubleshooting}</div>`
                        : ""
                    }
                  </div>
                </div>
              `
                )
                .join("")}
            </div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>

    <div class="lt-footer-banner">
      <span>Built with <strong><a href="https://github.com/jhonkeithman123/LoadTester" target="_blank">loadtester-kit</a></strong> • Zero-Config Overload Suite</span>
      <span>Press <kbd style="background:#1e293b;padding:2px 6px;border-radius:4px;color:#cbd5e1">Ctrl+F</kbd> to search</span>
    </div>
  </div>
</div>

<script>
  let activeCategory = 'all';

  function toggleGlossary() {
    const body = document.getElementById('lt-body-section');
    const arrow = document.getElementById('lt-arrow');
    if (body.style.display === 'none') {
      body.style.display = 'block';
      arrow.classList.add('open');
    } else {
      body.style.display = 'none';
      arrow.classList.remove('open');
    }
  }

  function setCategoryFilter(cat, btn) {
    activeCategory = cat;
    document.querySelectorAll('.lt-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterGlossary();
  }

  function filterGlossary() {
    const query = (document.getElementById('lt-search').value || '').toLowerCase();
    const categories = document.querySelectorAll('.lt-category-group');

    categories.forEach(catElem => {
      const catName = catElem.getAttribute('data-category');
      const matchesCategory = (activeCategory === 'all' || activeCategory === catName);

      if (!matchesCategory) {
        catElem.style.display = 'none';
        return;
      }

      const cards = catElem.querySelectorAll('.lt-term-card');
      let visibleInCat = 0;

      cards.forEach(card => {
        const text = card.getAttribute('data-term') || '';
        if (text.includes(query)) {
          card.style.display = 'block';
          visibleInCat++;
        } else {
          card.style.display = 'none';
        }
      });

      catElem.style.display = visibleInCat > 0 ? 'block' : 'none';
    });
  }

  // Automatic Localhost Dev Mode Detection
  document.addEventListener('DOMContentLoaded', function() {
    try {
      const pageText = document.body.innerText || '';
      const isLocalhost = pageText.includes('localhost:') || pageText.includes('127.0.0.1:');
      const hasHighLatency = pageText.match(/http_req_duration[\\s\\S]*?avg=([0-9.]+)s/);
      if (isLocalhost && hasHighLatency && parseFloat(hasHighLatency[1]) > 1.5) {
        const alertBox = document.getElementById('lt-diag-alert');
        if (alertBox) alertBox.style.display = 'block';
      }
    } catch (e) {}
  });
</script>
`;
}

module.exports = {
  generateGlossaryHtml
};
