const collectPageData = () => {
    const pageUrl = window.location.href;
    const h1Text = document.querySelector('h1')?.textContent?.trim() || '';
    const pageTitle = document.title || '';
    const clickTime = new Date().toISOString();
    return { pageUrl, clickTime, pageTitle, h1Text };
};
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

const scheduleSend = () => {
    const data = collectPageData();
    if (!shouldSend(data)) return; 
    if (sendTimer) clearTimeout(sendTimer);
    sendTimer = setTimeout(() => {
        sendTimer = null;
        const payload = collectPageData(); 
        if (shouldSend(payload)) csvPost(payload);
    }, DEBOUNCE_MS);
};

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

const setupDynamicTracking = () => {
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.type === 'childList' || m.type === 'characterData' || m.type === 'subtree') {
                scheduleSend();
                break;
            }
        }
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    const titleEl = document.querySelector('title');
    if (titleEl) {
        observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    window.addEventListener('popstate', scheduleSend);
    window.addEventListener('hashchange', scheduleSend);

    window.addEventListener('focus', scheduleSend);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') scheduleSend();
    });

    scheduleSend();
};

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setupDynamicTracking();
} else {
    document.addEventListener('DOMContentLoaded', setupDynamicTracking, { once: true });
}

const POLLING_ENABLED = true; 
const POLL_INTERVAL_MS = 2000;

document.addEventListener('click', (ev) => {
    try {
        const a = ev.target.closest && ev.target.closest('a[href^="#rpShowDynamicModalDocument-"] , a.rp-search-result-heading');
        if (a) {
            setTimeout(scheduleSend, 300);
        }
    } catch (e) {
    }
}, true);

if (window.jQuery) {
    try {
        window.jQuery(document).on('shown.bs.modal', '.modal', function () {
            scheduleSend();
        });
    } catch (e) {
    }
} else {
    document.addEventListener('shown.bs.modal', () => {
        scheduleSend();
    });
}

const modalNodeObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
        if (m.addedNodes && m.addedNodes.length) {
            for (const n of m.addedNodes) {
                if (n && n.nodeType === 1) {
                    const el =  (n);
                    if (el.classList && (el.classList.contains('modal') || el.getAttribute('role') === 'dialog' || el.querySelector && el.querySelector('.modal'))) {
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
}

if (POLLING_ENABLED) {
    let lastModalSnapshot = '';
    setInterval(() => {
        try {
            const modal = document.querySelector('.modal.in, .modal.show, [role="dialog"]');
            const snapshot = modal ? (modal.textContent || modal.innerText || '') : '';
            if (snapshot && snapshot !== lastModalSnapshot) {
                lastModalSnapshot = snapshot;
                scheduleSend();
            }
        } catch (e) {
        }
    }, POLL_INTERVAL_MS);
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
                        setTimeout(scheduleSend, 300);
                        throw e;
                    }
                };
                return true;
            }
        } catch (e) {
        }
        if (attempts < maxAttempts) {
            setTimeout(() => tryWrap(name, attempts + 1), delay);
        } else {
        }
    };

    for (const n of fnNames) tryWrap(n);
};

wrapGlobalPopupFns();
