/**
 * Currency Exchange App
 * Uses @fawazahmed0/currency-api
 */

// Configuration
const CONFIG = {
    API_BASE: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1',
    DEFAULT_FROM: 'usd',
    DEFAULT_TO: 'eur',
    AMOUNT: 1000
};

// State
let state = {
    currencies: {},
    fromCurrency: CONFIG.DEFAULT_FROM,
    toCurrency: CONFIG.DEFAULT_TO,
    amount: CONFIG.AMOUNT,
    rates: {},
    lastUpdated: null
};

// DOM Elements
const elements = {
    amountInput: document.getElementById('amount-input'),
    resultInput: document.getElementById('result-input'),
    // Hidden inputs for logic
    fromSelect: document.getElementById('from-currency-select'),
    toSelect: document.getElementById('to-currency-select'),
    // New Dropdown UI Elements
    fromBtn: document.getElementById('from-dropdown-btn'),
    toBtn: document.getElementById('to-dropdown-btn'),
    fromMenu: document.getElementById('from-dropdown-menu'),
    toMenu: document.getElementById('to-dropdown-menu'),
    fromList: document.getElementById('from-list'),
    toList: document.getElementById('to-list'),
    fromSearch: document.getElementById('from-search'),
    toSearch: document.getElementById('to-search'),
    fromFlag: document.getElementById('from-flag'),
    toFlag: document.getElementById('to-flag'),
    fromCodeDisplay: document.getElementById('from-code'),
    toCodeDisplay: document.getElementById('to-code'),

    swapBtn: document.getElementById('swap-btn'),
    rateDisplay: document.getElementById('rate-info'),
    feeDisplay: document.getElementById('fee-info'),
    lastUpdated: document.getElementById('last-updated')
};

/**
 * Initialize the application
 */
async function init() {
    try {
        await fetchCurrencies();
        // Set initial values
        if (elements.amountInput) elements.amountInput.value = state.amount;

        setupEventListeners();
        setupDropdowns();

        // Initial conversion
        await updateExchangeRate();
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to initialize application. Please try again later.');
    }
}

/**
 * Fetch available currencies
 */
async function fetchCurrencies() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/currencies.json`);
        if (!response.ok) throw new Error('Failed to fetch currencies');

        const data = await response.json();
        state.currencies = data;

    } catch (error) {
        console.error('Error fetching currencies:', error);
        showError('Could not load currency list.');
    }
}

/**
 * Setup Custom Dropdown Logic
 */
function setupDropdowns() {
    const currencies = Object.entries(state.currencies)
        .sort(([, a], [, b]) => a.localeCompare(b));

    // Render Lists
    renderDropdownList(elements.fromList, currencies, 'from');
    renderDropdownList(elements.toList, currencies, 'to');

    // Setup Toggles
    setupDropdownToggle(elements.fromBtn, elements.fromMenu, elements.fromSearch);
    setupDropdownToggle(elements.toBtn, elements.toMenu, elements.toSearch);

    // Setup Search
    setupSearch(elements.fromSearch, elements.fromList, currencies, 'from');
    setupSearch(elements.toSearch, elements.toList, currencies, 'to');

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!elements.fromBtn.contains(e.target) && !elements.fromMenu.contains(e.target)) {
            closeDropdown(elements.fromMenu);
        }
        if (!elements.toBtn.contains(e.target) && !elements.toMenu.contains(e.target)) {
            closeDropdown(elements.toMenu);
        }
    });

    // Initial Flag Update
    updateFlagAndText('from', state.fromCurrency);
    updateFlagAndText('to', state.toCurrency);
}

function renderDropdownList(container, list, type) {
    if (!container) return;
    container.innerHTML = list.map(([code, name]) => {
        const countryCode = code.slice(0, 2).toLowerCase();
        // Special cases for flags could be handled here
        const flagUrl = `https://flagcdn.com/w40/${countryCode}.png`;

        return `
            <div class="flex items-center gap-3 p-3 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors rounded-lg mx-1"
                onclick="selectCurrency('${type}', '${code}')">
                <img src="${flagUrl}" alt="${code}" class="w-6 h-6 rounded-full object-cover bg-slate-200"
                    onerror="this.src='https://placehold.co/40x40?text=${code.slice(0, 2).toUpperCase()}'">
                <div class="flex flex-col">
                    <span class="font-bold text-sm text-slate-900 dark:text-slate-100">${code.toUpperCase()}</span>
                    <span class="text-xs text-slate-500 truncate max-w-[140px]">${name}</span>
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
        // Close others
        closeAllDropdowns();
        if (isHidden) {
            menu.classList.remove('hidden');
            setTimeout(() => searchInput.focus(), 100);

            // Rotate arrow
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
    // Reset arrow
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

// Global scope for onclick
window.selectCurrency = (type, code) => {
    if (type === 'from') {
        state.fromCurrency = code;
        updateFlagAndText('from', code);
        closeDropdown(elements.fromMenu);
        updateExchangeRate();
    } else {
        state.toCurrency = code;
        updateFlagAndText('to', code);
        closeDropdown(elements.toMenu);
        calculateConversion(); // Just recalculate, no need to fetch if base hasn't changed (unless we want to support cross-rates perfectly, but base change logic is fetch)
        // Actually if 'to' changes, we just recalc. If 'from' changes, we refetch.
    }
};

function updateFlagAndText(type, code) {
    const flagImg = type === 'from' ? elements.fromFlag : elements.toFlag;
    const textSpan = type === 'from' ? elements.fromCodeDisplay : elements.toCodeDisplay;

    if (textSpan) textSpan.textContent = code.toUpperCase();
    if (flagImg) {
        flagImg.src = `https://flagcdn.com/w40/${code.slice(0, 2).toLowerCase()}.png`;
        flagImg.onerror = function () {
            this.src = `https://placehold.co/40x40?text=${code.slice(0, 2).toUpperCase()}`;
        };
    }
}

/**
 * Fetch exchange rates for the base currency
 */
async function updateExchangeRate() {
    if (!state.fromCurrency) return;

    // Show loading state
    if (elements.rateDisplay) elements.rateDisplay.innerHTML = 'Rate: <strong class="text-slate-100">Loading...</strong>';

    try {
        const response = await fetch(`${CONFIG.API_BASE}/currencies/${state.fromCurrency}.json`);
        if (!response.ok) throw new Error('Failed to fetch rates');

        const data = await response.json();
        // The API returns { date: "...", [currency]: { ...rates } }
        state.rates = data[state.fromCurrency];
        state.lastUpdated = data.date;

        calculateConversion();
        updateUI();
    } catch (error) {
        console.error('Error fetching rates:', error);
        showError('Could not fetch exchange rates.');
    }
}

/**
 * Calculate conversion result
 */
function calculateConversion() {
    if (!state.rates || !state.rates[state.toCurrency]) return;

    const rate = state.rates[state.toCurrency];
    const result = state.amount * rate;

    if (elements.resultInput) {
        elements.resultInput.value = result.toFixed(2);
    }

    updateRateDisplay(rate);
}

/**
 * Update UI elements
 */
function updateUI() {
    if (state.lastUpdated && elements.lastUpdated) {
        elements.lastUpdated.textContent = `Updated: ${state.lastUpdated}`;
    }
}

/**
 * Update rate display text
 */
function updateRateDisplay(rate) {
    if (elements.rateDisplay) {
        elements.rateDisplay.innerHTML = `1 ${state.fromCurrency.toUpperCase()} = ${rate.toFixed(4)} ${state.toCurrency.toUpperCase()}`;
    }
}

/**
 * Setup Event Listeners
 */
function setupEventListeners() {
    // Amount Input
    if (elements.amountInput) {
        elements.amountInput.addEventListener('input', (e) => {
            state.amount = parseFloat(e.target.value) || 0;
            calculateConversion();
        });
    }

    // Swap Button
    if (elements.swapBtn) {
        elements.swapBtn.addEventListener('click', () => {
            // Swap state
            const tempCurr = state.fromCurrency;
            state.fromCurrency = state.toCurrency;
            state.toCurrency = tempCurr;

            // Update UI
            updateFlagAndText('from', state.fromCurrency);
            updateFlagAndText('to', state.toCurrency);

            // Recalculate
            updateExchangeRate();
        });
    }
}

/**
 * Show error message
 */
function showError(msg) {
    console.error(msg);
}

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
