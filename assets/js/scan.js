/**
 * OCR Price Scanner
 * Uses Tesseract.js and @fawazahmed0/currency-api
 */

// Configuration
const CONFIG = {
    API_BASE: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1',
    DEFAULT_FROM: 'usd',
    DEFAULT_TO: 'myr'
};

// State
let state = {
    stream: null,
    isProcessing: false,
    rates: {},
    currencies: {},
    from: CONFIG.DEFAULT_FROM,
    target: CONFIG.DEFAULT_TO
};

// DOM Elements
const elements = {
    // Camera Elements
    video: document.getElementById('camera-stream'),
    canvas: document.getElementById('snapshot-canvas'),
    captureBtn: document.getElementById('capture-btn'),

    // Upload Elements
    uploadBtn: document.getElementById('upload-btn'),
    fileInput: document.getElementById('file-input'),
    previewContainer: document.getElementById('image-preview-container'),
    previewImage: document.getElementById('image-preview'),
    clearPreviewBtn: document.getElementById('clear-preview-btn'),

    // Result Elements
    resultOverlay: document.getElementById('result-overlay'),
    detectedDisplay: document.getElementById('detected-amount'),
    convertedDisplay: document.getElementById('converted-amount'),
    closeResultBtn: document.getElementById('close-result'),

    // Custom Dropdowns
    fromBtn: document.getElementById('from-dropdown-btn'),
    toBtn: document.getElementById('to-dropdown-btn'),
    fromMenu: document.getElementById('from-dropdown-menu'),
    toMenu: document.getElementById('to-dropdown-menu'),
    fromList: document.getElementById('from-list'),
    toList: document.getElementById('to-list'),
    fromSearch: document.getElementById('from-search'),
    toSearch: document.getElementById('to-search'),
    fromInput: document.getElementById('scan-currency-from'),
    toInput: document.getElementById('scan-currency-to'),

    // Display Elements
    fromFlag: document.getElementById('from-flag'),
    toFlag: document.getElementById('to-flag'),
    fromCode: document.getElementById('from-code'),
    toCode: document.getElementById('to-code')
};

/**
 * Initialize Scanner
 */
async function init() {
    try {
        await fetchCurrencies();
        setupDropdowns();
        setupEventListeners();

        // Camera will be started by setupEventListeners
        await fetchRate(state.from);

        console.log('Scanner Initialized');
    } catch (error) {
        console.error('Scanner Init Error:', error);
        alert('Could not access camera. Please ensure you are on HTTPS or Localhost.');
    }
}

/**
 * Fetch Full Currency List
 */
async function fetchCurrencies() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/currencies.json`);
        const data = await response.json();
        state.currencies = data; // { usd: "United States Dollar", ... }
    } catch (error) {
        console.error('Failed to fetch currencies', error);
        // Fallback or retry?
    }
}

/**
 * Setup Custom Dropdown Logic
 */
function setupDropdowns() {
    const list = Object.entries(state.currencies)
        // Sort by Code
        .sort(([codeA], [codeB]) => codeA.localeCompare(codeB));

    renderDropdownList(elements.fromList, list, 'from');
    renderDropdownList(elements.toList, list, 'to');

    // Toggles
    setupDropdownToggle(elements.fromBtn, elements.fromMenu, elements.fromSearch);
    setupDropdownToggle(elements.toBtn, elements.toMenu, elements.toSearch);

    // Search
    setupSearch(elements.fromSearch, elements.fromList, list, 'from');
    setupSearch(elements.toSearch, elements.toList, list, 'to');

    // Click Outside
    document.addEventListener('click', (e) => {
        if (elements.fromBtn && !elements.fromBtn.contains(e.target) && !elements.fromMenu.contains(e.target)) {
            closeDropdown(elements.fromMenu);
        }
        if (elements.toBtn && !elements.toBtn.contains(e.target) && !elements.toMenu.contains(e.target)) {
            closeDropdown(elements.toMenu);
        }
    });

    // Initial UI Update
    updateFlagAndText('from', state.from);
    updateFlagAndText('to', state.target);
}

function renderDropdownList(container, list, type) {
    if (!container) return;

    // Convert list to HTML
    // Note: fawazahmed0 returns lowercase keys. We want to display uppercase.
    // FlagCDN requires code (2-letter). Usually slicing currency code works for major ones (USD->us, EUR->eu).
    // Some logic might be needed for non-standard, but simple slice(0,2) covers 90%.

    container.innerHTML = list.map(([code, name]) => {
        const upperCode = code.toUpperCase();
        // FlagCDN uses country codes. Currency code slice 0,2 works for many (USD->US, MYR->MY), but EUR->EU.
        // Simple heuristic: slice(0,2) lowercased.
        const flagCode = upperCode.slice(0, 2).toLowerCase();

        return `
            <div class="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors rounded-lg mx-1"
                onclick="window.selectScanCurrency('${type}', '${code}')">
                <img src="https://flagcdn.com/w40/${flagCode}.png" alt="${upperCode}" class="w-6 h-6 rounded-full object-cover bg-slate-200"
                    onerror="this.src='https://placehold.co/40x40?text=${upperCode.slice(0, 2)}'">
                <div class="flex flex-col">
                    <span class="font-bold text-xs text-slate-900 dark:text-slate-100">${upperCode}</span>
                    <span class="text-[10px] text-slate-500 truncate max-w-[120px]">${name}</span>
                </div>
            </div>
        `;
    }).join('');
}

function setupDropdownToggle(btn, menu, searchInput) {
    if (!btn || !menu) return;
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = menu.classList.contains('hidden');
        closeAllDropdowns();

        if (isHidden) {
            menu.classList.remove('hidden');
            setTimeout(() => searchInput.focus(), 100);
            const arrow = btn.querySelector('.material-icons');
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        }
    });
}

function closeAllDropdowns() {
    closeDropdown(elements.fromMenu);
    closeDropdown(elements.toMenu);
}

function closeDropdown(menu) {
    if (!menu) return;
    menu.classList.add('hidden');

    const type = menu.id.includes('from') ? 'from' : 'to';
    const btn = type === 'from' ? elements.fromBtn : elements.toBtn;
    const arrow = btn?.querySelector('.material-icons');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
}

function setupSearch(input, listContainer, fullList, type) {
    if (!input) return;
    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = fullList.filter(([code, name]) =>
            code.toLowerCase().includes(term) || name.toLowerCase().includes(term)
        );
        renderDropdownList(listContainer, filtered, type);
    });
}

// Global selection handler
window.selectScanCurrency = (type, code) => {
    if (type === 'from') {
        state.from = code;
        elements.fromInput.value = code;
        updateFlagAndText('from', code);
        closeDropdown(elements.fromMenu);
        fetchRate(code); // Update rates for new base
    } else {
        state.target = code;
        elements.toInput.value = code;
        updateFlagAndText('to', code);
        closeDropdown(elements.toMenu);

        // If result shown, update conversion immediately
        if (!elements.resultOverlay.classList.contains('hidden')) {
            const detected = parseFloat(elements.detectedDisplay.textContent);
            if (!isNaN(detected)) showResult(detected);
        }
    }
};

function updateFlagAndText(type, code) {
    const flagImg = type === 'from' ? elements.fromFlag : elements.toFlag;
    const textSpan = type === 'from' ? elements.fromCode : elements.toCode;
    const upperCode = code.toUpperCase();

    if (textSpan) textSpan.textContent = upperCode;
    if (flagImg) {
        flagImg.src = `https://flagcdn.com/w40/${upperCode.slice(0, 2).toLowerCase()}.png`;
        flagImg.onerror = function () {
            this.src = `https://placehold.co/40x40?text=${upperCode.slice(0, 2)}`;
        };
    }
}


/**
 * Camera & Upload Logic
 */
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
        });
        elements.video.srcObject = stream;
        state.stream = stream;
        elements.video.play(); // Start playing the stream
    } catch (err) {
        throw err;
    }
}

/**
 * Fetch Exchange Rate
 */
async function fetchRate(fromCurrency) {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/currencies/${fromCurrency}.json`);
        const data = await response.json();
        state.rates = data[fromCurrency];
    } catch (error) {
        console.error('Error fetching rate:', error);
    }
}

/**
 * Unified Process Function
 */
async function processImageSource(imageSource) {
    if (state.isProcessing) return;

    state.isProcessing = true;
    elements.captureBtn.classList.add('opacity-50', 'pointer-events-none');
    elements.captureBtn.innerHTML = '<span class="material-icons animate-spin text-primary">autorenew</span>';

    try {
        const result = await Tesseract.recognize(
            imageSource,
            'eng',
            { logger: m => console.log(m) }
        );

        const text = result.data.text;
        console.log('OCR Result:', text);
        processText(text);

    } catch (error) {
        console.error('OCR Error:', error);
        alert('Failed to read text. Please try again.');
    } finally {
        state.isProcessing = false;
        elements.captureBtn.classList.remove('opacity-50', 'pointer-events-none');
        elements.captureBtn.innerHTML = '<div class="w-16 h-16 bg-white rounded-full group-hover:scale-90 transition-transform duration-200"></div>';
    }
}

/**
 * Extract Price and Convert
 */
function processText(text) {
    // Matches 12.99, 1,234.50, $12.99, RM123
    // Simple regex for grabbing the first valid number-like string
    const priceRegex = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/g;
    const matches = text.match(priceRegex);

    if (matches && matches.length > 0) {
        let rawPrice = matches[0].replace(/,/g, '');
        const price = parseFloat(rawPrice);

        if (!isNaN(price)) {
            showResult(price);
        } else {
            alert('Could not detect a valid price number.');
        }
    } else {
        alert('No price detected. Please try holding the camera closer or uploading a clearer image.');
    }
}

/**
 * Show Conversion Result
 */
function showResult(amount) {
    const targetCurrency = state.target;
    const rate = state.rates[targetCurrency];

    if (!rate) {
        fetchRate(state.from).then(() => showResult(amount));
        return;
    }

    const converted = amount * rate;

    // Format Display
    elements.detectedDisplay.textContent = `${amount.toFixed(2)}`;

    const symbol = targetCurrency.toUpperCase();
    elements.convertedDisplay.innerHTML = `<span class="text-xl">${symbol}</span> ${converted.toFixed(2)}`;

    elements.resultOverlay.classList.remove('hidden');
}

/**
 * Event Listeners
 */
function setupEventListeners() {
    // Start camera initially
    startCamera();

    // 1. Capture Button (Camera vs Preview)
    elements.captureBtn.addEventListener('click', () => {
        if (!elements.previewContainer.classList.contains('hidden')) {
            // Process the uploaded image
            processImageSource(elements.previewImage); // Tesseract accepts <img>
        } else {
            // Process Camera Frame via Canvas
            const ctx = elements.canvas.getContext('2d');
            elements.canvas.width = elements.video.videoWidth;
            elements.canvas.height = elements.video.videoHeight;
            ctx.drawImage(elements.video, 0, 0, elements.canvas.width, elements.canvas.height);
            const image = elements.canvas.toDataURL('image/png');
            processImageSource(image);
        }
    });

    // 2. Upload Button
    if (elements.uploadBtn) {
        elements.uploadBtn.addEventListener('click', () => {
            elements.fileInput.click();
        });
    }

    // 3. File Input Change
    if (elements.fileInput) {
        elements.fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    elements.previewImage.src = e.target.result;
                    elements.previewContainer.classList.remove('hidden');
                    // Stop camera stream to save battery
                    if (state.stream) state.stream.getVideoTracks().forEach(track => track.enabled = false);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // 4. Clear Preview
    if (elements.clearPreviewBtn) {
        elements.clearPreviewBtn.addEventListener('click', () => {
            elements.previewImage.src = '';
            elements.previewContainer.classList.add('hidden');
            elements.fileInput.value = '';

            // Resume Camera
            if (state.stream) state.stream.getVideoTracks().forEach(track => track.enabled = true);

            // Hide result if shown
            elements.resultOverlay.classList.add('hidden');
        });
    }

    // 5. Result Overlay
    elements.closeResultBtn.addEventListener('click', () => {
        elements.resultOverlay.classList.add('hidden');
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);
