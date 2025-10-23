// Function to collect current page data
const collectPageData = () => {
    const pageUrl = window.location.href;
    const h1Text = document.querySelector('h1')?.textContent?.trim() || '';
    const pageTitle = document.title || '';
    const clickTime = new Date().toISOString();
    return { pageUrl, clickTime, pageTitle, h1Text };
};

// Debounced sender with change-detection to avoid duplicate posts
const endpoint = 'https://uncelibate-malisa-limy.ngrok-free.dev/api/track-page-view';
let lastSent = { pageUrl: null, pageTitle: null, h1Text: null };
let sendTimer = null;
const DEBOUNCE_MS = 500;

const csvPost = async (data) => {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (response.ok) {
            // update lastSent snapshot on success
            lastSent = { pageUrl: data.pageUrl, pageTitle: data.pageTitle, h1Text: data.h1Text };
            console.log('Page view data sent successfully.', data);
        } else {
            console.error('Failed to send page view data. Server status:', response.status);
        }
    } catch (error) {
        console.error('Error sending page view data:', error);
    }
};

const shouldSend = (d) => {
    return d.pageUrl !== lastSent.pageUrl || d.pageTitle !== lastSent.pageTitle || d.h1Text !== lastSent.h1Text;
};

const scheduleSend = () => {
    const data = collectPageData();
    if (!shouldSend(data)) return; // nothing changed
    if (sendTimer) clearTimeout(sendTimer);
    sendTimer = setTimeout(() => {
        sendTimer = null;
        const payload = collectPageData(); // re-collect to get up-to-date values
        if (shouldSend(payload)) csvPost(payload);
    }, DEBOUNCE_MS);
};

// Execute the function when DOM is ready. If the DOM is already loaded, run immediately.
const runWhenReady = () => {
    try {
        trackPageView();
    } catch (e) {
        console.error('trackPageView failed:', e);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runWhenReady, { once: true });
} else {
    runWhenReady();
}

// Once ready, set up dynamic trackers so popups or SPA navigations are captured
const setupDynamicTracking = () => {
    // MutationObserver: watch for H1 or title changes
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            // If H1 text changes or title changes, schedule a send
            if (m.type === 'childList' || m.type === 'characterData' || m.type === 'subtree') {
                scheduleSend();
                break;
            }
        }
    });

    // Observe the document body for subtree changes (new content inside popup)
    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    // Observe the <title> element specifically
    const titleEl = document.querySelector('title');
    if (titleEl) {
        observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    // Listen for history navigation (single-page apps)
    window.addEventListener('popstate', scheduleSend);
    window.addEventListener('hashchange', scheduleSend);

    // Visibility/focus: if popup regains focus, re-evaluate content
    window.addEventListener('focus', scheduleSend);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') scheduleSend();
    });

    // Initial scheduled send for current state
    scheduleSend();
};

// Start dynamic tracking after DOM is ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setupDynamicTracking();
} else {
    document.addEventListener('DOMContentLoaded', setupDynamicTracking, { once: true });
}