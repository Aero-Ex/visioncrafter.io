// In script.js (Final Version with Self-Cleaning History)

document.addEventListener('DOMContentLoaded', () => {
    const config = {
        api: {
            imageGeneration: '/api/images/generations',
            videoGeneration: '/api/videos/generations'
        },
        storageKeys: {
            images: 'visionCrafterHistory_images',
            videos: 'visionCrafterHistory_videos',
            apiKey: 'visionCrafter_apiKey'
        },
        modelsUrl: './models.json'
    };
    let MODEL_CONFIG = {};

    // --- ELEMENT SELECTORS (omitted for brevity, they are unchanged) ---
    const generationForm = document.getElementById('image-generator-form');
    const modelSelect = document.getElementById('model-select');
    const generateBtn = document.getElementById('generate-btn');
    const historyGrid = document.getElementById('history-grid');
    const historyPlaceholder = historyGrid.querySelector('.history-section__placeholder');
    const videoForm = document.getElementById('video-generator-form');
    const videoGenerateBtn = document.getElementById('video-generate-btn');
    const videoHistoryGrid = document.getElementById('history-grid-video');
    const videoHistoryPlaceholder = videoHistoryGrid.querySelector('.history-section__placeholder');
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxClose = document.querySelector('.lightbox__close');
    const apiKeyModal = document.getElementById('api-key-modal');
    const apiKeyInput = document.getElementById('api-key-input');
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    const changeKeyBtn = document.getElementById('change-key-btn');
    
    // --- (Functions for API key modal, API requests, form submissions are unchanged) ---
    function showApiKeyModal() { apiKeyModal.classList.add('show'); }
    function hideApiKeyModal() { apiKeyModal.classList.remove('show'); }
    function saveApiKey() {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem(config.storageKeys.apiKey, key);
            hideApiKeyModal();
        } else {
            alert('Please enter a valid API key.');
        }
    }
    async function handleApiRequest(endpoint, payload, button, gridElement, placeholderElement, storageKey) {
        const apiKey = localStorage.getItem(config.storageKeys.apiKey);
        if (!apiKey) {
            alert('API Key not found. Please set your API key.');
            showApiKeyModal();
            return;
        }
        setButtonState(button, '<span class="icon">⏳</span>Generating...', true);
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey, payload })
            });
            const responseText = await response.text();
            if (response.status === 401) {
                alert('Your API Key is invalid or has been rejected. Please check your key and try again.');
                showApiKeyModal();
                throw new Error('Invalid API Key');
            }
            if (!response.ok) {
                if (responseText.includes('504 Gateway Time-out')) {
                    throw new Error('API Timeout: The generation took too long.');
                }
                throw new Error(responseText);
            }
            const result = JSON.parse(responseText);
            if (placeholderElement) placeholderElement.style.display = 'none';
            result.data.forEach(mediaObject => {
                const mediaData = { src: mediaObject.url, prompt: payload.prompt };
                addHistoryItem(mediaData, gridElement, storageKey);
            });
        } catch (error) {
            console.error("API call failed:", error.message);
            if (error.message !== 'Invalid API Key') {
                try {
                    const errorJson = JSON.parse(error.message);
                    alert(`Error: ${errorJson.detail?.error?.message || errorJson.error || errorJson.detail || JSON.stringify(errorJson)}`);
                } catch (parseError) {
                    alert(`Error: ${error.message}`);
                }
            }
        } finally {
            setButtonState(button, `<span class="icon">✨</span>${gridElement.id.includes('video') ? 'Generate Video' : 'Generate'}`, false);
        }
    }
    function setButtonState(button, text, disabled) {
        button.innerHTML = text;
        button.disabled = disabled;
    }
    async function handleGenerationFormSubmit(e) {
        e.preventDefault();
        const modelId = modelSelect.value;
        const payload = buildApiPayload(generationForm, modelId);
        handleApiRequest(config.api.imageGeneration, payload, generateBtn, historyGrid, historyPlaceholder, config.storageKeys.images);
    }
    async function handleVideoFormSubmit(e) {
        e.preventDefault();
        const modelId = document.getElementById('video-model-select').value;
        const payload = buildApiPayload(videoForm, modelId);
        if (!payload.prompt) {
            alert("Please provide a prompt for video generation.");
            return;
        }
        handleApiRequest(config.api.videoGeneration, payload, videoGenerateBtn, videoHistoryGrid, videoHistoryPlaceholder, config.storageKeys.videos);
    }
    function buildApiPayload(formElement, modelId) {
        const formData = new FormData(formElement);
        const model = MODEL_CONFIG[modelId];
        let payload = { model: modelId };
        for (const paramName in model.params) {
            const config = model.params[paramName];
            let value = formData.get(paramName);
            if (value === null || value === '') continue;
            if (paramName === 'n' || paramName === 'duration') {
                value = parseInt(value, 10);
            } else if (config.type === 'number' || config.type === 'range') {
                value = parseFloat(value);
            } else if (config.type === 'boolean') {
                value = formData.get(paramName) === 'on';
            }
            const apiName = config.api_name || paramName;
            const apiValue = config.value_map ? config.value_map[String(value)] : value;
            if (apiValue !== undefined) payload[apiName] = apiValue;
        }
        return payload;
    }
    async function fetchModelConfig() {
        try {
            const response = await fetch(config.modelsUrl);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            const data = await response.json();
            MODEL_CONFIG = data.models;
            initializeForms();
        } catch (error) {
            console.error("Fatal: Could not load models.json", error);
            alert("Error: Could not load model configurations. The application cannot start.");
        }
    }
    function initializeForms() {
        const imageModels = Object.keys(MODEL_CONFIG).filter(id => MODEL_CONFIG[id].type === 'generation');
        populateSelect(modelSelect, imageModels, id => MODEL_CONFIG[id].name);
        const videoModels = Object.keys(MODEL_CONFIG).filter(id => MODEL_CONFIG[id].type === 'video');
        populateSelect(document.getElementById('video-model-select'), videoModels, id => MODEL_CONFIG[id].name);
        updateUISettings();
    }
    function populateSelect(selectElement, options, textAccessor = val => val) {
        selectElement.innerHTML = '';
        options.forEach(optionValue => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = textAccessor(optionValue);
            selectElement.appendChild(option);
        });
    }
    function updateUISettings() {
        const selectedModelId = modelSelect.value;
        if (!selectedModelId || !MODEL_CONFIG[selectedModelId]) return;
        const model = MODEL_CONFIG[selectedModelId];
        const params = model.params;
        document.querySelectorAll('.model-settings').forEach(setting => setting.style.display = 'none');
        const familySettings = document.getElementById(`${model.family}-settings`);
        if (familySettings) familySettings.style.display = 'block';
        for (const paramName in params) {
            const config = params[paramName];
            const element = document.getElementById(`${paramName}-setting`) || document.getElementById(`${model.family}-${paramName}-setting`);
            if (element) element.style.display = 'flex';
            if (config.type === 'select' && config.options) {
                const select = document.querySelector(`select[name="${paramName}"]`);
                if (select) populateSelect(select, config.options, val => String(val).charAt(0).toUpperCase() + String(val).slice(1));
            }
            if (config.type === 'radio' && config.max) {
                const radios = document.querySelectorAll(`input[name="${paramName}"]`);
                radios.forEach(radio => {
                    const label = document.querySelector(`label[for="${radio.id}"]`);
                    const isDisabled = parseInt(radio.value) > config.max;
                    radio.disabled = isDisabled;
                    if (label) {
                        label.style.opacity = isDisabled ? 0.5 : 1;
                        label.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
                    }
                });
                if (document.querySelector(`input[name="${paramName}"]:checked`)?.disabled) {
                    document.querySelector(`input[name="${paramName}"]:not(:disabled)`)?.checked = true;
                }
            }
        }
    }

    // --- HISTORY MANAGEMENT (MODIFIED) ---

    // ✅ MODIFIED: addHistoryItem now passes down the grid and key
    function addHistoryItem(mediaData, gridElement, storageKey) {
        const historyItemElement = createHistoryItem(mediaData, gridElement, storageKey);
        if (historyItemElement) {
            const placeholder = gridElement.querySelector('.history-section__placeholder');
            if (placeholder) placeholder.style.display = 'none';
            gridElement.prepend(historyItemElement);
            saveHistory(gridElement, storageKey);
        }
    }

    // ✅ MODIFIED: createHistoryItem now accepts the grid and key, and has a new onerror handler
    function createHistoryItem(mediaData, gridElement, storageKey) {
        if (!mediaData || !mediaData.src) return null;
        
        const wrapper = document.createElement('div');
        wrapper.className = 'history-item-wrapper history-item-wrapper--loading';
        wrapper.dataset.prompt = mediaData.prompt;

        const isVideo = mediaData.src.endsWith('.mp4') || mediaData.src.endsWith('.webm');
        const mediaElement = document.createElement(isVideo ? 'video' : 'img');
        
        mediaElement.src = mediaData.src;
        mediaElement.alt = mediaData.prompt;

        if(isVideo) {
            mediaElement.muted = true; mediaElement.loop = true; mediaElement.playsInline = true; mediaElement.autoplay = true;
            mediaElement.addEventListener('canplay', () => wrapper.classList.remove('history-item-wrapper--loading'), { once: true });
        } else {
            mediaElement.onload = () => wrapper.classList.remove('history-item-wrapper--loading');
        }
        
        // THIS IS THE SELF-CLEANING LOGIC
        mediaElement.onerror = () => {
            console.warn(`Failed to load history item: ${mediaData.src}. Removing from history.`);
            wrapper.remove(); // 1. Remove the broken element from the page
            saveHistory(gridElement, storageKey); // 2. Re-save the history, which is now clean

            // 3. If the grid is now empty, show the placeholder text again
            const placeholder = gridElement.querySelector('.history-section__placeholder');
            if (gridElement.childElementCount <= 1 && placeholder) { // <= 1 because placeholder itself is a child
                placeholder.style.display = 'flex';
            }
        };

        const overlay = document.createElement('div');
        overlay.className = 'item-overlay';
        const fileExtension = isVideo ? 'mp4' : 'png';
        let buttonsHTML = `<a href="${mediaData.src}" download="visioncrafter_${Date.now()}.${fileExtension}" class="overlay-btn" title="Download">📥</a><button class="overlay-btn" data-action="delete" title="Delete">🗑️</button>`;
        if (!isVideo) {
            buttonsHTML += `<button class="overlay-btn" data-action="view" title="View Fullscreen">👁️</button>`;
        }
        overlay.innerHTML = buttonsHTML;
        
        wrapper.appendChild(mediaElement);
        wrapper.appendChild(overlay);
        return wrapper;
    }

    function saveHistory(gridElement, storageKey) {
        const historyItems = [];
        gridElement.querySelectorAll('.history-item-wrapper').forEach(wrapper => {
            const media = wrapper.querySelector('img, video');
            if (media && media.src) {
                historyItems.push({ src: media.src, prompt: wrapper.dataset.prompt || '' });
            }
        });
        localStorage.setItem(storageKey, JSON.stringify(historyItems.slice(0, 50)));
    }

    // ✅ MODIFIED: loadHistory now passes down the grid and key
    function loadHistory(gridElement, placeholderElement, storageKey) {
        const savedHistory = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (savedHistory.length > 0) {
            if (placeholderElement) placeholderElement.style.display = 'none';
            savedHistory.forEach(itemData => {
                const itemEl = createHistoryItem(itemData, gridElement, storageKey);
                if (itemEl) gridElement.appendChild(itemEl);
            });
        }
    }

    // --- EVENT LISTENERS (UNCHANGED) ---
    function setupEventListeners() {
        const toggleSwitch = document.querySelector('.toggle-switch');
        toggleSwitch.addEventListener('click', () => {
            toggleSwitch.classList.toggle('active');
            const isVideoActive = toggleSwitch.classList.contains('active');
            document.getElementById('generation-view').style.display = isVideoActive ? 'none' : 'flex';
            document.getElementById('video-generation-view').style.display = isVideoActive ? 'flex' : 'none';
            toggleSwitch.querySelectorAll('.toggle-switch__option').forEach((opt, i) => {
                opt.classList.toggle('toggle-switch__option--active', i === (isVideoActive ? 1 : 0));
            });
        });
        const advancedSettingsHeader = document.querySelector('.advanced-settings__header');
        advancedSettingsHeader.addEventListener('click', () => {
            advancedSettingsHeader.classList.toggle('active');
            advancedSettingsHeader.nextElementSibling.classList.toggle('show');
        });
        document.querySelectorAll('.range-group').forEach(group => {
            const rangeInput = group.querySelector('input[type="range"]');
            const numberInput = group.querySelector('input[type="number"]');
            if (!rangeInput || !numberInput) return;
            const updateRangeVisual = () => {
                const min = +rangeInput.min || 0, max = +rangeInput.max || 100, val = +rangeInput.value;
                const percentage = (max - min === 0) ? 100 : ((val - min) * 100 / (max - min));
                rangeInput.style.background = `linear-gradient(to right, var(--color-primary) ${percentage}%, var(--color-bg-input) ${percentage}%)`;
            };
            rangeInput.addEventListener('input', () => { numberInput.value = rangeInput.value; updateRangeVisual(); });
            numberInput.addEventListener('input', () => { rangeInput.value = numberInput.value; updateRangeVisual(); });
            updateRangeVisual();
        });
        modelSelect.addEventListener('change', updateUISettings);
        generationForm.addEventListener('submit', handleGenerationFormSubmit);
        videoForm.addEventListener('submit', handleVideoFormSubmit);
        document.getElementById('random-seed-btn').addEventListener('click', () => {
            document.getElementById('seed-input').value = Math.floor(Math.random() * 1000000000);
        });
        document.body.addEventListener('click', (e) => {
            const wrapper = e.target.closest('.history-item-wrapper');
            if (!wrapper) return;
            const button = e.target.closest('button.overlay-btn');
            if (button) {
                e.preventDefault(); e.stopPropagation();
                const action = button.dataset.action;
                if (action === 'delete') {
                    if (confirm('Are you sure you want to delete this item?')) {
                        const grid = wrapper.parentElement;
                        wrapper.remove();
                        const storageKey = grid.id === 'history-grid' ? config.storageKeys.images : config.storageKeys.videos;
                        const placeholder = grid.querySelector('.history-section__placeholder');
                        saveHistory(grid, storageKey);
                        if (grid.childElementCount <= 1 && placeholder) {
                             placeholder.style.display = 'flex';
                        }
                    }
                } else if (action === 'view') {
                    const media = wrapper.querySelector('img');
                    if(media && media.src) {
                        lightboxImage.src = media.src;
                        lightboxImage.alt = media.alt;
                        lightboxModal.classList.add('show');
                    }
                }
            }
        });
        const closeModal = () => lightboxModal.classList.remove('show');
        lightboxClose.addEventListener('click', closeModal);
        lightboxModal.addEventListener('click', (e) => { if (e.target === lightboxModal) closeModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === "Escape") closeModal(); });
        saveApiKeyBtn.addEventListener('click', saveApiKey);
        changeKeyBtn.addEventListener('click', showApiKeyModal);
    }

    // --- INITIALIZATION (UNCHANGED) ---
    function init() {
        setupEventListeners();
        fetchModelConfig();
        loadHistory(historyGrid, historyPlaceholder, config.storageKeys.images);
        loadHistory(videoHistoryGrid, videoHistoryPlaceholder, config.storageKeys.videos);
        if (!localStorage.getItem(config.storageKeys.apiKey)) {
            showApiKeyModal();
        }
    }

    init();
});
