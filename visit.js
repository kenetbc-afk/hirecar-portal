/**
 * HIRECAR visitor beacon.
 * Fires one POST per session per site to /api/visit. Use:
 *   <script src="https://hirecar-portal.pages.dev/visit.js" data-site="<slug>" async></script>
 * If data-site is omitted we use the hostname.
 */
(function () {
  try {
    var script = document.currentScript || (function () {
      var s = document.getElementsByTagName('script');
      return s[s.length - 1];
    })();
    var site = (script && script.getAttribute('data-site')) || location.hostname || 'unknown';
    var sessionKey = 'hc_visit_' + site;
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');

    var vid = localStorage.getItem('hc_vid');
    if (!vid) {
      vid = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : ('v-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10));
      localStorage.setItem('hc_vid', vid);
    }

    fetch('https://hirecar-portal.pages.dev/api/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        visitor_id: vid,
        site: site,
        page: location.pathname + location.search,
        referrer: document.referrer || ''
      }),
      keepalive: true
    }).catch(function () {});
  } catch (e) {}
})();
