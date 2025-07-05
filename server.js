// In server.js (Final Version for user-provided API keys)

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000; // Use environment variable for port

const API_BASE_URL = 'https://api.a4f.co/v1';

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for potential image uploads
app.use(express.static(path.join(__dirname, 'public')));

// --- API PROXY FUNCTION ---
async function proxyRequest(req, res, apiPath) {
    const { apiKey, payload } = req.body;

    // Validate that a key was provided by the user.
    if (!apiKey) {
        return res.status(400).json({ error: 'API key is missing in the request.' });
    }
    if (!payload || !payload.model) {
        return res.status(400).json({ error: 'Payload or model is missing in the request.' });
    }

    const requestOptions = {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 300000 // 5 minutes
    };

    try {
        const response = await fetch(`${API_BASE_URL}${apiPath}`, requestOptions);
        const responseData = await response.text();
        res.status(response.status).send(responseData);
    } catch (error) {
        console.error(`Proxy Error for ${apiPath}:`, error);
        res.status(504).json({ error: 'Proxy Timeout or Network Error' });
    }
}

// --- API PROXY ROUTES ---
app.post('/api/images/generations', (req, res) => {
    proxyRequest(req, res, '/images/generations');
});

app.post('/api/videos/generations', (req, res) => {
    proxyRequest(req, res, '/video/generations');
});

// --- FRONT-END ROUTES ---
app.get('/app', (req, res) => {
    // UPDATED: This route now serves the renamed app page: app.html
    res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/', (req, res) => {
    // UPDATED: This now correctly serves the landing page, which is now index.html
    // This also works perfectly with Render's default behavior.
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- SERVER START ---
app.listen(PORT, () => {
    console.log(`✅ VisionCrafter proxy server running on http://localhost:${PORT}`);
});
