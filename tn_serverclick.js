// app.js (Conceptual Server-Side Code)
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

// Path to the CSV file (store logs on D:\clicklog)
const logDir = path.join('D:', 'clicklog');

// Create the log directory if it doesn't exist
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const dateString = `${year}-${month}-${day}`;
const CSV_FILE = path.join(logDir, `${dateString}_clicked_data.csv`);

// CSV Headers (added h1Text as a separate column)
const CSV_HEADERS = "clickTime,pageUrl,h1Text,pageTitle\n";

app.use(cors()); // Enable CORS for all requests
app.use(express.json()); // Middleware to parse JSON body

/**
 * Convert incoming value to a plain string for CSV output.
 * - If it's a string, return as-is
 * - If it's an object with textContent/innerText, use that
 * - Otherwise, stringify safely
 */
const valueToText = (val) => {
    if (val == null) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'object') {
        if (typeof val.textContent === 'string' && val.textContent.trim() !== '') return val.textContent;
        if (typeof val.innerText === 'string' && val.innerText.trim() !== '') return val.innerText;
        try {
            // If it's a plain object with a 'text' or 'title' prop, prefer those
            if (typeof val.text === 'string' && val.text.trim() !== '') return val.text;
            if (typeof val.title === 'string' && val.title.trim() !== '') return val.title;
            // If it's an empty object (common when a DOM element was passed), return empty string
            if (Object.keys(val).length === 0) return '';
            // Fallback to JSON representation but treat '{}' or '[]' as empty
            const json = JSON.stringify(val);
            if (json === '{}' || json === '[]') return '';
            return json;
        } catch (e) {
            return String(val);
        }
    }
    const s = String(val);
    return s.trim();
};

// Limit CSV field length to avoid huge entries
const truncate = (s, max = 1000) => {
    if (!s) return '';
    if (s.length <= max) return s;
    return s.slice(0, max) + '...';
};

/**
 * Escape a string for safe CSV embedding: double internal quotes and remove newlines.
 */
const csvEscape = (s) => {
    if (s == null) return '';
    const str = String(s).replace(/\r?\n/g, ' ');
    return str.replace(/"/g, '""');
};

/**
 * Ensures the CSV file exists and has headers.
 */
const ensureCsvHeaders = () => {
    if (!fs.existsSync(CSV_FILE)) {
        console.log(`Creating new CSV file: ${CSV_FILE}`);
        // Write the header row
        fs.writeFileSync(CSV_FILE, CSV_HEADERS);
    }
};

// --- API Endpoint to receive the data ---
app.post('/api/track-page-view', (req, res) => {
    const { pageUrl, clickTime, pageTitle, h1Text } = req.body;

    if (!pageUrl || !clickTime) {
        return res.status(400).send({ message: 'Missing pageUrl or clickTime in request.' });
    }

    // 1. Ensure the file exists and has headers
    ensureCsvHeaders();

    // 2. Convert values to text and escape for CSV
    const h1TextClean = truncate(valueToText(h1Text), 500);
    const titleText = truncate(valueToText(pageTitle), 500);
    const newEntry = `"${csvEscape(clickTime)}","${csvEscape(pageUrl)}","${csvEscape(h1TextClean)}","${csvEscape(titleText)}"\n`;

    // 3. Append the data to the CSV file
    fs.appendFile(CSV_FILE, newEntry, { encoding: 'utf8' }, (err) => {
        if (err) {
            console.error('Error saving click data to CSV:', err);
            return res.status(500).send({ message: 'Error saving data on server.' });
        }
        console.log(`Page view saved: ${pageUrl}`);
        res.status(200).send({ message: 'Page view tracked successfully.' });
    });
});

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    ensureCsvHeaders(); // Ensure headers on startup
});
