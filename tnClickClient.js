// Function to send page load data to the server
const trackPageView = async () => {
    // 1. Capture the required data
    const pageUrl = window.location.href;       // Get the full URL of the current page
    // Prefer the first <h1> text if present, otherwise fall back to document.title
    // Use optional chaining to avoid null dereference and trim whitespace
    const pageTitle = document.querySelector('h1')?.textContent?.trim() || document.title;
    const clickTime = new Date().toISOString(); // Get the current time in ISO format

    const data = {
        pageUrl: pageUrl,
        clickTime: clickTime,
        pageTitle: pageTitle
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

// Execute the function immediately when the script is loaded
// This effectively tracks the "click" of opening the URL/page
trackPageView();