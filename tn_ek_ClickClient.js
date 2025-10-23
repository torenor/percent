// Function to collect current page data
const collectPageData = () => {
    const pageUrl = window.location.href;
    const h1Text = document.querySelector('h1')?.textContent?.trim() || '';
    const pageTitle = document.title || '';
    const clickTime = new Date().toISOString();
    return { pageUrl, clickTime, pageTitle, h1Text };
};
// change detection
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

// --- Modal-specific helpers and polling fallback ---
// Configure polling and debug here
const DEBUG_TRACKING = false; // set true to enable verbose console.debug
const POLLING_ENABLED = true; // fallback polling if other signals fail
const POLL_INTERVAL_MS = 2000;

// Delegated click handler for links that open the dynamic modal in this app
document.addEventListener('click', (ev) => {
    try {
        const a = ev.target.closest && ev.target.closest('a[href^="#rpShowDynamicModalDocument-"] , a.rp-search-result-heading');
        if (a) {
            if (DEBUG_TRACKING) console.debug('Modal-trigger link clicked:', a.href || a.getAttribute('href'));
            // schedule a send shortly after click to allow modal content to be injected
            setTimeout(scheduleSend, 300);
        }
    } catch (e) {
        if (DEBUG_TRACKING) console.debug('click handler error', e);
    }
}, true);

// Listen for Bootstrap modal shown event. Bootstrap uses jQuery events; attach via jQuery if present.
if (window.jQuery) {
    try {
        window.jQuery(document).on('shown.bs.modal', '.modal', function () {
            if (DEBUG_TRACKING) console.debug('shown.bs.modal event (jQuery)');
            scheduleSend();
        });
    } catch (e) {
        if (DEBUG_TRACKING) console.debug('jQuery modal listener error', e);
    }
} else {
    // Some implementations may dispatch a native event - listen defensively
    document.addEventListener('shown.bs.modal', () => {
        if (DEBUG_TRACKING) console.debug('shown.bs.modal event (native)');
        scheduleSend();
    });
}

// MutationObserver specifically watching for added modal nodes (class 'modal' or role='dialog')
const modalNodeObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
            for (const n of m.addedNodes) {
                if (n && n.nodeType === 1) {
                    const el = /** @type HTMLElement */ (n);
                    if (el.classList && (el.classList.contains('modal') || el.getAttribute('role') === 'dialog' || el.querySelector && el.querySelector('.modal'))) {
                        if (DEBUG_TRACKING) console.debug('Modal node added to DOM', el);
                        scheduleSend();
                        return;
                    }
                }
            }
        }
    }
});
try {
    modalNodeObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
} catch (e) {
    if (DEBUG_TRACKING) console.debug('modalNodeObserver failed to observe', e);
}

// Polling fallback: detect changes in modal visibility or content if other signals miss it
if (POLLING_ENABLED) {
    let lastModalSnapshot = '';
    setInterval(() => {
        try {
            const modal = document.querySelector('.modal.in, .modal.show, [role="dialog"]');
            const snapshot = modal ? (modal.textContent || modal.innerText || '') : '';
            if (snapshot && snapshot !== lastModalSnapshot) {
                if (DEBUG_TRACKING) console.debug('Modal snapshot changed (polling)');
                lastModalSnapshot = snapshot;
                scheduleSend();
            }
        } catch (e) {
            if (DEBUG_TRACKING) console.debug('polling error', e);
        }
    }, POLL_INTERVAL_MS);
}

// --- Wrap known popup-opening globals (if the app uses functions to open modals) ---
const wrapGlobalPopupFns = (fnNames = ['rpShowDynamicModalDocument', 'rpDocumentPropertiesPopup']) => {
    const tryWrap = (name, attempts = 0) => {
        const maxAttempts = 50;
        const delay = 200;
        try {
            const original = window[name];
            if (typeof original === 'function') {
                window[name] = function (...args) {
                    if (DEBUG_TRACKING) console.debug(`Wrapped ${name} called with`, args);
                    try {
                        const res = original.apply(this, args);
                        // schedule send shortly after the function runs so modal content can be injected
                        setTimeout(scheduleSend, 300);
                        return res;
                    } catch (e) {
                        if (DEBUG_TRACKING) console.debug(`Error calling original ${name}:`, e);
                        setTimeout(scheduleSend, 300);
                        throw e;
                    }
                };
                if (DEBUG_TRACKING) console.debug(`Wrapped global function: ${name}`);
                return true;
            }
        } catch (e) {
            if (DEBUG_TRACKING) console.debug('wrapGlobalPopupFns error', e);
        }
        if (attempts < maxAttempts) {
            setTimeout(() => tryWrap(name, attempts + 1), delay);
        } else {
            if (DEBUG_TRACKING) console.debug(`Giving up wrapping ${name} after ${maxAttempts} attempts`);
        }
    };

    for (const n of fnNames) tryWrap(n);
};

// Try to wrap known popup handlers used in the portal
wrapGlobalPopupFns();