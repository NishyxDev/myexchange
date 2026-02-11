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

// DOM Elements (Populated in init)
let elements = {};

/**
 * Initialize Scanner
 */
async function init() {
    try {
        // Initialize DOM Elements
        elements = {
            video: document.getElementById('camera-stream'),
            canvas: document.getElementById('snapshot-canvas'),
            captureBtn: document.getElementById('capture-btn'),
            resultOverlay: document.getElementById('result-overlay'),
            detectedDisplay: document.getElementById('detected-amount'),
            convertedDisplay: document.getElementById('converted-amount'),
            closeResultBtn: document.getElementById('close-result'),
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
            fromFlag: document.getElementById('from-flag'),
            toFlag: document.getElementById('to-flag'),
            fromCode: document.getElementById('from-code'),
            toCode: document.getElementById('to-code')
        };

        await fetchCurrencies();
        setupDropdowns();
        setupEventListeners();
        await startCamera();
        await fetchRate(state.from);

        console.log('Scanner Initialized');
    } catch (error) {
        console.error('Scanner Init Error:', error);
        alert('Could not access camera. Please ensure you are on HTTPS or Localhost.');
    }
}

async function fetchCurrencies() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/currencies.json`);
        const data = await response.json();
        state.currencies = data;
    } catch (error) {
        console.error('Failed to fetch currencies', error);
    }
}

function setupDropdowns() {
    if (!state.currencies || Object.keys(state.currencies).length === 0) return;

    const list = Object.entries(state.currencies).sort(([a], [b]) => a.localeCompare(b));
    renderDropdownList(elements.fromList, list, 'from');
    renderDropdownList(elements.toList, list, 'to');
    setupDropdownToggle(elements.fromBtn, elements.fromMenu, elements.fromSearch);
    setupDropdownToggle(elements.toBtn, elements.toMenu, elements.toSearch);
    setupSearch(elements.fromSearch, elements.fromList, list, 'from');
    setupSearch(elements.toSearch, elements.toList, list, 'to');

    document.addEventListener('click', (e) => {
        if (elements.fromBtn && !elements.fromBtn.contains(e.target) && !elements.fromMenu.contains(e.target)) {
            closeDropdown(elements.fromMenu);
        }
        if (elements.toBtn && !elements.toBtn.contains(e.target) && !elements.toMenu.contains(e.target)) {
            closeDropdown(elements.toMenu);
        }
    });

    updateFlagAndText('from', state.from);
    updateFlagAndText('to', state.target);
}

function renderDropdownList(container, list, type) {
    if (!container) return;
    container.innerHTML = list.map(([code, name]) => {
        const upperCode = code.toUpperCase();
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

window.selectScanCurrency = (type, code) => {
    if (type === 'from') {
        state.from = code;
        elements.fromInput.value = code;
        updateFlagAndText('from', code);
        closeDropdown(elements.fromMenu);
        fetchRate(code);
    } else {
        state.target = code;
        elements.toInput.value = code;
        updateFlagAndText('to', code);
        closeDropdown(elements.toMenu);
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

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
        });
        elements.video.srcObject = stream;
        state.stream = stream;
    } catch (err) {
        console.error("Camera error:", err);
    }
}

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
 * Preprocess Image for Better OCR
 * Converts to grayscale and enhances contrast
 */
function preprocessImage(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to Grayscale and Enhance Contrast
    for (let i = 0; i < data.length; i += 4) {
        // Grayscale conversion using luminosity method
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Enhance contrast (simple method)
        const contrast = 1.5; // Contrast factor
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        const enhanced = factor * (gray - 128) + 128;

        // Clamp values between 0-255
        const final = Math.max(0, Math.min(255, enhanced));

        data[i] = final;     // Red
        data[i + 1] = final; // Green
        data[i + 2] = final; // Blue
        // Alpha channel (data[i + 3]) stays the same
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

async function captureAndProcess() {
    if (state.isProcessing) return;

    state.isProcessing = true;
    elements.captureBtn.classList.add('opacity-50', 'pointer-events-none');
    elements.captureBtn.innerHTML = '<span class="material-icons animate-spin text-primary">autorenew</span>';

    try {
        // Step 1: Capture frame to canvas
        const ctx = elements.canvas.getContext('2d');
        elements.canvas.width = elements.video.videoWidth;
        elements.canvas.height = elements.video.videoHeight;
        ctx.drawImage(elements.video, 0, 0);

        // Step 2: Preprocess - Grayscale + Contrast Enhancement
        preprocessImage(elements.canvas);

        // Step 3: Convert processed canvas to image
        const processedImage = elements.canvas.toDataURL('image/png');

        console.log('Processing preprocessed image...');

        // Step 4: OCR on preprocessed image
        const result = await Tesseract.recognize(processedImage, 'eng', {
            logger: m => console.log(m)
        });

        const text = result.data.text;
        console.log('OCR Text:', text);

        // Simple price extraction - look for numbers with decimal points
        const priceMatch = text.match(/\d+[.,]\d{2}/);

        if (priceMatch) {
            const rawPrice = priceMatch[0].replace(',', '.');
            const price = parseFloat(rawPrice);

            if (!isNaN(price) && price > 0) {
                showResult(price);
            } else {
                alert('No valid price detected. Please try again.');
            }
        } else {
            alert('No price found. Please point camera at a price tag with clear numbers.');
        }

    } catch (error) {
        console.error('OCR Error:', error);
        alert('Failed to scan. Please try again.');
    } finally {
        state.isProcessing = false;
        elements.captureBtn.classList.remove('opacity-50', 'pointer-events-none');
        elements.captureBtn.innerHTML = '<div class="w-16 h-16 bg-white rounded-full group-hover:scale-90 transition-transform duration-200"></div>';
    }
}

function showResult(amount) {
    const rate = state.rates[state.target];
    if (!rate) {
        fetchRate(state.from).then(() => showResult(amount));
        return;
    }

    const converted = amount * rate;
    elements.detectedDisplay.textContent = `${amount.toFixed(2)}`;
    elements.convertedDisplay.innerHTML = `<span class="text-xl">${state.target.toUpperCase()}</span> ${converted.toFixed(2)}`;
    elements.resultOverlay.classList.remove('hidden');
}

function setupEventListeners() {
    if (elements.captureBtn) {
        elements.captureBtn.addEventListener('click', captureAndProcess);
    }
    if (elements.closeResultBtn) {
        elements.closeResultBtn.addEventListener('click', () => {
            elements.resultOverlay.classList.add('hidden');
        });
    }
}

document.addEventListener('DOMContentLoaded', init);
