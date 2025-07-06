// In server.js (Final Version for user-provided API keys)

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000; // Use environment variable for port
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL; // Securely get webhook URL from server environment

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

app.post('/api/video/generations', (req, res) => {
    proxyRequest(req, res, '/video/generations');
});

// --- NEW INSTAGRAM SHARE PROXY ROUTE (FIX FOR CORS) ---
app.post('/api/share/instagram', async (req, res) => {
    if (!N8N_WEBHOOK_URL) {
        console.error('N8N_WEBHOOK_URL is not set on the server.');
        return res.status(500).json({ error: 'Server configuration error: Sharing service is not configured.' });
    }

    const { imageUrl, prompt } = req.body;
    if (!imageUrl || !prompt) {
        return res.status(400).json({ error: 'imageUrl and prompt are required.' });
    }

    try {
        const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageUrl, prompt })
        });

        if (!n8nResponse.ok) {
            const errorText = await n8nResponse.text();
            console.error(`n8n webhook call failed with status ${n8nResponse.status}:`, errorText);
            return res.status(n8nResponse.status).send(errorText || 'Webhook call failed.');
        }

        const responseData = await n8nResponse.json();
        res.status(200).json(responseData);

    } catch (error) {
        console.error('Error proxying request to n8n webhook:', error);
        res.status(502).json({ error: 'Bad Gateway: Could not connect to the sharing service.' });
    }
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
