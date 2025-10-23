// Function to send page load data to the server
const trackPageView = async () => {
    // 1. Capture the required data
    const pageUrl = window.location.href;       // Get the full URL of the current page
    // Capture both the first <h1> text AND the document.title separately
    // h1Text will be empty string if no <h1> exists
    const h1Text = document.querySelector('h1')?.textContent?.trim() || '';
    const pageTitle = document.title || '';
    const clickTime = new Date().toISOString(); // Get the current time in ISO format

    const data = {
        pageUrl: pageUrl,
        clickTime: clickTime,
        pageTitle: pageTitle,
        h1Text: h1Text
    };
    
    // NOTE: This endpoint must match your server's route
    //const endpoint = 'http://localhost:3000/api/track-page-view'; 
    const endpoint = 'https://uncelibate-malisa-limy.ngrok-free.dev/api/track-page-view';
    //const endpoint = endpointurl

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data) 
        });

        if (response.ok) {
            console.log('Page view data sent successfully.');
        } else {
            // Log the error but don't stop the page from loading
            console.error('Failed to send page view data. Server status:', response.status);
        }
    } catch (error) {
        console.error('Error sending page view data:', error);
    }
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