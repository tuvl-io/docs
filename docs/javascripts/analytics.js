// tuvl Docs: GA4 events. gtag is loaded by overrides/templates/extra_head.html.
// Every listener is delegated on document, so it keeps working whatever the theme re-renders.
(function () {
  function track(name, params) {
    if (typeof gtag !== 'function') return;
    gtag('event', name, Object.assign({ site_id: 'docs' }, params || {}));
  }

  var path = location.pathname.replace(/^\/+|\/+$/g, '');
  var section = path.split('/')[0] || 'home';
  if (typeof gtag === 'function') gtag('set', { site_id: 'docs', content_group: section });

  // Outbound links: where do readers go next?
  var destinations = [
    ['try.tuvl.online', 'try'], ['nest.tuvl.io', 'nest'], ['github.com', 'github'],
    ['pypi.org', 'pypi'], ['npmjs.com', 'npm'], ['discord.gg', 'discord'], ['tuvl.io', 'portal'],
  ];
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (a) {
      var href = a.getAttribute('href') || '';
      if (/^https?:\/\//.test(href)) {
        var host = '';
        try { host = new URL(href).hostname; } catch (err) { return; }
        if (host === 'tuvl.dev') return;
        var dest = 'external';
        for (var i = 0; i < destinations.length; i++) {
          if (host === destinations[i][0] || host.endsWith('.' + destinations[i][0]) || host.indexOf(destinations[i][0]) !== -1) { dest = destinations[i][1]; break; }
        }
        var text = (a.textContent || '').trim().slice(0, 60) || href;
        track('outbound_click', { destination: dest, link_url: href, link_text: text, page_section: section });
        if (dest === 'try') track('try_live', { location: 'docs' });
      }
    }
    var t = e.target.closest && e.target.closest('button');
    if (!t) return;
    if (t.id === 'copy-page') track('copy_page_markdown', { page_section: section });
    else if (t.classList.contains('search')) track('search_open', { via: 'click' });
    else if ((t.getAttribute('onclick') || '').indexOf('onThemeSwitch') !== -1) track('theme_toggle', {});
    else if (/copy/i.test(t.className + ' ' + (t.getAttribute('title') || '') + ' ' + (t.getAttribute('aria-label') || ''))) track('code_copy', { page_section: section });
    var r = e.target.closest && e.target.closest('#search-dialog a[href], [role="dialog"] a[href]');
    if (r) track('search_result_click', { query: lastQuery, result_path: (r.getAttribute('href') || '').slice(0, 120) });
  }, true);

  // Search: opening with the keyboard, and what people look for (debounced, 3+ characters).
  var lastQuery = '';
  var timer = null;
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) track('search_open', { via: 'keyboard' });
  });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || !el.matches || !el.matches('input[type="search"], input[cmdk-input]')) return;
    clearTimeout(timer);
    timer = setTimeout(function () {
      var q = (el.value || '').trim().toLowerCase().slice(0, 80);
      if (q.length < 3 || q === lastQuery) return;
      lastQuery = q;
      track('search_query', { query: q });
    }, 1200);
  });

  // Text copied out of a code block.
  document.addEventListener('copy', function () {
    var sel = window.getSelection && window.getSelection();
    var node = sel && sel.anchorNode && sel.anchorNode.parentElement;
    if (!node || !node.closest('pre, code') || !String(sel).trim()) return;
    track('code_copy', { page_section: section, length: String(sel).length });
  });

  // How far down a page people read, and how long the tab is open and visible.
  var seen = {};
  window.addEventListener('scroll', function () {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return;
    var pct = (window.scrollY / max) * 100;
    [25, 50, 75, 100].forEach(function (m) {
      if (pct >= m - 1 && !seen[m]) { seen[m] = 1; track('scroll_depth', { percent: m, page_section: section }); }
    });
  }, { passive: true });
  var visible = 0;
  setInterval(function () {
    if (document.visibilityState !== 'visible') return;
    visible += 1;
    if (visible === 15 || visible === 60 || visible === 180) track('engaged_time', { seconds: visible, page_section: section });
  }, 1000);

  // Pages that do not exist, load timing, script errors (at most 3 per load).
  document.addEventListener('DOMContentLoaded', function () {
    if (/^\s*404|not found/i.test(document.title)) track('docs_404', { path: location.pathname.slice(0, 120), referrer: document.referrer.slice(0, 120) });
  });
  var errors = 0;
  window.addEventListener('error', function (e) {
    if (errors++ >= 3) return;
    track('js_error', { message: String(e.message || 'error').slice(0, 100), source: String(e.filename || '').split('/').pop().slice(0, 60) });
  });
  window.addEventListener('load', function () {
    setTimeout(function () {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav) track('page_timing', { load_ms: Math.round(nav.loadEventEnd), dom_ms: Math.round(nav.domContentLoadedEventEnd), page_section: section });
    }, 0);
  });
})();
