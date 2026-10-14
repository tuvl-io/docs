// tuvl Docs — GA4 custom dimensions
// Runs after gtag is already loaded by MkDocs Material's analytics plugin.
// Tags every page view with site_id=docs so GA4 can filter portal vs docs.
document.addEventListener('DOMContentLoaded', function () {
    if (typeof gtag !== 'function') return;

    // Custom dimension: site_id (configure as a custom dimension in GA4 admin)
    gtag('set', { site_id: 'docs' });

    // Track outbound links to portal and GitHub
    document.querySelectorAll('a[href]').forEach(function (link) {
        var href = link.getAttribute('href');
        if (!href) return;
        var isPortal = href.includes('tuvl.io');
        var isGitHub = href.includes('github.com');
        if (!isPortal && !isGitHub) return;

        link.addEventListener('click', function () {
            gtag('event', 'outbound_click', {
                destination: isPortal ? 'portal' : 'github',
                link_url:    href,
                link_text:   link.textContent.trim() || href,
                site_id:     'docs',
            });
        });
    });
});
