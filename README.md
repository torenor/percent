# tnClickClient.js Documentation

## Overview

`tnClickClient.js` is a client-side JavaScript for tracking user navigation and interactions on a web page. It is designed to work with both traditional static pages and modern Single-Page Applications (SPAs) where content changes dynamically without a full page reload. It has a particular focus on reliably detecting content changes within modal dialogs and popups.

The script collects page information (URL, title, H1 text), and sends it to a specified backend endpoint. It uses a debouncing mechanism to avoid sending excessive or duplicate data, ensuring that data is only sent when meaningful changes have occurred.

## Features

- **Page View Tracking**: Collects URL, page title, H1 content, and a timestamp.
- **Change Detection**: Monitors the DOM for changes to the page title and H1 tag, automatically tracking updates in SPAs.
- **Debounced Sending**: Prevents spamming the server by only sending data after a brief period of inactivity.
- **Duplicate Prevention**: Avoids sending the same data repeatedly if the page state has not changed.
- **SPA Navigation Tracking**: Listens for `popstate` and `hashchange` events to capture in-app navigation.
- **Advanced Modal/Popup Tracking**: Uses multiple strategies to detect when modal dialogs appear and their content changes:
    - Click event delegation on modal-triggering links.
    - Listeners for Bootstrap modal events (`shown.bs.modal`).
    - A `MutationObserver` to watch for the insertion of modal elements into the DOM.
    - A polling fallback to catch modal changes that other methods might miss.
    - Wrapping of global JavaScript functions known to open popups.
- **Debug Mode**: Includes a `DEBUG_TRACKING` flag to enable verbose logging for development and troubleshooting.

## How It Works

### 1. Data Collection

The `collectPageData` function gathers the following information from the current page:
- `pageUrl`: The full URL of the current window (`window.location.href`).
- `pageTitle`: The content of the `<title>` tag.
- `h1Text`: The text content of the first `<h1>` element found.
- `clickTime`: The ISO 8601 timestamp of when the data was collected.

### 2. Change Detection and Sending

To avoid sending redundant information, the script maintains a snapshot of the last successfully sent data (`lastSent`).

1.  **`shouldSend(data)`**: This function compares the current page data (URL, title, H1) with the `lastSent` snapshot. It returns `true` only if something has changed.
2.  **`scheduleSend()`**: When an event (like a click or DOM mutation) occurs, this function is called. It collects the current page data and checks if it `shouldSend`. If so, it sets a timer (`setTimeout`).
3.  **Debouncing**: If another event happens within the `DEBOUNCE_MS` window (500ms), the previous timer is cleared and a new one is set. This ensures the script waits for a pause in activity before sending data.
4.  **`csvPost(data)`**: Once the timer completes, this function sends the final collected data as a JSON payload to the configured `endpoint`. If the request is successful, it updates the `lastSent` snapshot.

### 3. Dynamic Page and Modal Tracking

The script employs a comprehensive set of listeners to track changes in dynamic environments.

- **`MutationObserver`**: A primary observer watches the `document.body` and `<title>` tag for any changes (additions, deletions, text changes). When a change is detected, it triggers `scheduleSend`.
- **History and Focus Events**: It listens for `popstate`, `hashchange`, `focus`, and `visibilitychange` events to capture SPA navigations and instances where the user tabs back to the page.
- **Modal-Specific Click Handler**: It uses a delegated event listener to detect clicks on links that are known to open modals (e.g., `a[href^="#rpShowDynamicModalDocument-"]`).
- **Bootstrap Modal Events**: If jQuery is present, it hooks into Bootstrap's `shown.bs.modal` event. It also includes a defensive listener for a native event of the same name.
- **Modal Node Observer**: A separate `MutationObserver` is dedicated to watching for when new nodes with the class `.modal` or `role="dialog"` are added to the DOM.
- **Function Wrapping**: The script attempts to "wrap" known global functions (like `rpShowDynamicModalDocument`) that trigger popups. This intercepts the function call and schedules a data send shortly after, allowing time for the modal's content to load.
- **Polling Fallback**: As a final safety net, an optional polling mechanism (`setInterval`) periodically checks the content of any visible modal. If the content has changed since the last check, it triggers `scheduleSend`.

### 4. Initialization

The script is designed to run as soon as the DOM is ready. It uses the `DOMContentLoaded` event to initialize its main functions (`trackPageView` and `setupDynamicTracking`). This ensures all necessary elements are available before the listeners are attached.

## Configuration

A few constants at the top of the modal-specific section can be configured:

- `endpoint`: The URL of the server API that will receive the tracking data.
- `DEBUG_TRACKING` (default: `false`): Set to `true` to enable detailed `console.debug` messages, which is useful for troubleshooting why and when data is being sent.
- `POLLING_ENABLED` (default: `true`): Enables or disables the polling fallback mechanism for modal tracking.
- `POLL_INTERVAL_MS` (default: `800`): The time in milliseconds between each poll check.

## Usage

To use this script, include it in your HTML file, typically just before the closing `</body>` tag.

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>My Awesome Page</title>
</head>
<body>
    <h1>Welcome</h1>
    <!-- Your content here -->

    <script src="tnClickClient.js"></script>
</body>
</html>
```

## Dependencies

- **jQuery (Optional)**: The script can leverage jQuery to listen for Bootstrap's modal events (`shown.bs.modal`). However, it is not a hard requirement. The script includes fallbacks and other detection mechanisms that work without jQuery.
