// 7. Make Endpoint Configurable
const getEndpoint = () => {
    const scriptTag = document.currentScript;
    if (scriptTag && scriptTag.dataset.endpoint) {
        return scriptTag.dataset.endpoint;
    }
    // Fallback to a default
    return 'https://uncelibate-malisa-limy.ngrok-free.dev/api/track-page-view';
};
const endpoint = getEndpoint();

const collectPageData = () => {
    const pageUrl = window.location.href;
    const h1Text = document.querySelector('h1')?.textContent?.trim() || '';
    const pageTitle = document.title || '';
    const clickTime = new Date().toISOString();
    return { pageUrl, clickTime, pageTitle, h1Text };
};

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
            lastSent = { pageUrl: data.pageUrl, pageTitle: data.pageTitle, h1Text: data.h1Text };
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

// 1. Reduce Redundant Data Collection in scheduleSend
const scheduleSend = () => {
    if (sendTimer) {
        clearTimeout(sendTimer);
    }
    sendTimer = setTimeout(() => {
        sendTimer = null;
        const payload = collectPageData();
        if (shouldSend(payload)) {
            csvPost(payload);
        }
    }, DEBOUNCE_MS);
};

const setupDynamicTracking = () => {
    // 3. Scope MutationObserver More Narrowly
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            // Watching for childList changes is generally safer and more performant than characterData.
            if (m.type === 'childList' || m.type === 'subtree') {
                scheduleSend();
                break;
            }
        }
    });

    if (document.body) {
        // Observing subtree is still necessary for many dynamic sites, but characterData is removed for performance.
        observer.observe(document.body, { childList: true, subtree: true });
    }

    const titleEl = document.querySelector('title');
    if (titleEl) {
        // Title changes are important and less frequent.
        observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    window.addEventListener('popstate', scheduleSend);
    window.addEventListener('hashchange', scheduleSend);

    window.addEventListener('focus', scheduleSend);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') scheduleSend();
    });

    scheduleSend(); // Initial send on load
};

// 5. Improve Error Handling
document.addEventListener('click', (ev) => {
    try {
        const a = ev.target.closest && ev.target.closest('a[href^="#rpShowDynamicModalDocument-"] , a.rp-search-result-heading');
        if (a) {
            setTimeout(scheduleSend, 300);
        }
    } catch (e) {
        console.error('Error in click listener:', e);
    }
}, true);

// 4. Remove jQuery Dependency
document.addEventListener('shown.bs.modal', () => {
    scheduleSend();
});

// 2. Replace Polling with MutationObserver
const modalNodeObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
            for (const n of m.addedNodes) {
                if (n && n.nodeType === 1) {
                    const el = (n);
                    if (el.classList && (el.classList.contains('modal') || el.getAttribute('role') === 'dialog' || el.querySelector && el.querySelector('.modal'))) {
                        scheduleSend();
                        // Once a modal is found, observe it for internal changes, replacing the need for polling.
                        const modalContentObserver = new MutationObserver(scheduleSend);
                        modalContentObserver.observe(el, { childList: true, subtree: true, characterData: true });
                        return; // Stop searching after finding and observing the modal
                    }
                }
            }
        }
    }
});

try {
    modalNodeObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
} catch (e) {
    console.error('Failed to initialize modalNodeObserver:', e);
}

const wrapGlobalPopupFns = (fnNames = ['rpShowDynamicModalDocument', 'rpDocumentPropertiesPopup']) => {
    const tryWrap = (name, attempts = 0) => {
        const maxAttempts = 50;
        const delay = 200;
        try {
            const original = window[name];
            if (typeof original === 'function') {
                window[name] = function (...args) {
                    try {
                        const res = original.apply(this, args);
                        setTimeout(scheduleSend, 300);
                        return res;
                    } catch (e) {
                        // Still schedule a send even if the original function fails.
                        setTimeout(scheduleSend, 300);
                        throw e; // Re-throw the error after scheduling.
                    }
                };
                return true;
            }
        } catch (e) {
            console.error(`Failed to wrap function ${name}:`, e);
        }

        if (attempts < maxAttempts) {
            setTimeout(() => tryWrap(name, attempts + 1), delay);
        }
    };

    for (const n of fnNames) tryWrap(n);
};

// 6. Consolidate DOM-Ready Execution
const initializeTracking = () => {
    try {
        // The 'trackPageView' function is not defined in the original script.
        // If it exists globally, it would be called here.
        // trackPageView();
    } catch (e) {
        console.error('trackPageView failed:', e);
    }
    setupDynamicTracking();
    wrapGlobalPopupFns();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTracking, { once: true });
} else {
    initializeTracking();
}