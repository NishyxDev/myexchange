/**
 * Currency Trends Logic
 * Uses Frankfurter.dev API (No Key Required)
 */

// Configuration
const CONFIG = {
    API_BASE: 'https://api.frankfurter.app',
    DEFAULT_BASE: 'USD',
    DEFAULT_TARGET: 'EUR',
    DAYS: 7
};

// State
let state = {
    base: CONFIG.DEFAULT_BASE,
    target: CONFIG.DEFAULT_TARGET,
    days: CONFIG.DAYS,
    chart: null,
    currencies: {}
};

// DOM Elements
const elements = {
    // Hidden Inputs
    baseInput: document.getElementById('trend-base'),
    targetInput: document.getElementById('trend-target'),

    // Custom Dropdown UI
    baseBtn: document.getElementById('base-dropdown-btn'),
    targetBtn: document.getElementById('target-dropdown-btn'),
    baseMenu: document.getElementById('base-dropdown-menu'),
    targetMenu: document.getElementById('target-dropdown-menu'),
    baseList: document.getElementById('base-list'),
    targetList: document.getElementById('target-list'),
    baseSearch: document.getElementById('base-search'),
    targetSearch: document.getElementById('target-search'),

    // Display Elements
    baseFlag: document.getElementById('base-flag'),
    targetFlag: document.getElementById('target-flag'),
    baseCode: document.getElementById('base-code'),
    targetCode: document.getElementById('target-code'),

    swapBtn: document.getElementById('trend-swap'),
    chartCanvas: document.getElementById('trendChart'),
    timeButtons: document.querySelectorAll('[data-days]')
};

/**
 * Initialize Trends Page
 */
async function init() {
    await fetchCurrencies();
    setupDropdowns();
    setupEventListeners();
    updateChart();
}

/**
 * Fetch available currencies
 */
async function fetchCurrencies() {
    try {
        const response = await fetch(`${CONFIG.API_BASE}/currencies`);
        const data = await response.json();
        state.currencies = data;
    } catch (error) {
        console.error('Failed to fetch currencies', error);
    }
}

/**
 * Setup Custom Dropdown Logic
 */
function setupDropdowns() {
    const currencies = Object.entries(state.currencies)
        .sort(([, a], [, b]) => a.localeCompare(b));

    // Render Lists
    renderDropdownList(elements.baseList, currencies, 'base');
    renderDropdownList(elements.targetList, currencies, 'target');

    // Setup Toggles
    setupDropdownToggle(elements.baseBtn, elements.baseMenu, elements.baseSearch);
    setupDropdownToggle(elements.targetBtn, elements.targetMenu, elements.targetSearch);

    // Setup Search
    setupSearch(elements.baseSearch, elements.baseList, currencies, 'base');
    setupSearch(elements.targetSearch, elements.targetList, currencies, 'target');

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (elements.baseBtn && !elements.baseBtn.contains(e.target) && !elements.baseMenu.contains(e.target)) {
            closeDropdown(elements.baseMenu);
        }
        if (elements.targetBtn && !elements.targetBtn.contains(e.target) && !elements.targetMenu.contains(e.target)) {
            closeDropdown(elements.targetMenu);
        }
    });

    // Initial Flag Update
    updateFlagAndText('base', state.base);
    updateFlagAndText('target', state.target);
}

function renderDropdownList(container, list, type) {
    if (!container) return;
    container.innerHTML = list.map(([code, name]) => {
        const countryCode = code.slice(0, 2).toLowerCase();
        const flagUrl = `https://flagcdn.com/w40/${countryCode}.png`;

        return `
            <div class="flex items-center gap-3 p-3 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors rounded-lg mx-1"
                onclick="selectCurrency('${type}', '${code}')">
                <img src="${flagUrl}" alt="${code}" class="w-6 h-6 rounded-full object-cover bg-slate-200"
                    onerror="this.src='https://placehold.co/40x40?text=${code.slice(0, 2).toUpperCase()}'">
                <div class="flex flex-col">
                    <span class="font-bold text-sm text-slate-900 dark:text-slate-100">${code}</span>
                    <span class="text-xs text-slate-500 truncate max-w-[200px]">${name}</span>
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
    closeDropdown(elements.baseMenu);
    closeDropdown(elements.targetMenu);
}

function closeDropdown(menu) {
    if (!menu) return;
    menu.classList.add('hidden');

    // Reset arrow
    const type = menu.id.includes('base') ? 'base' : 'target';
    const btn = type === 'base' ? elements.baseBtn : elements.targetBtn;
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
    if (type === 'base') {
        state.base = code;
        elements.baseInput.value = code;
        updateFlagAndText('base', code);
        closeDropdown(elements.baseMenu);
    } else {
        state.target = code;
        elements.targetInput.value = code;
        updateFlagAndText('target', code);
        closeDropdown(elements.targetMenu);
    }
    updateChart();
};

function updateFlagAndText(type, code) {
    const flagImg = type === 'base' ? elements.baseFlag : elements.targetFlag;
    const textSpan = type === 'base' ? elements.baseCode : elements.targetCode;

    if (textSpan) textSpan.textContent = code;
    if (flagImg) {
        flagImg.src = `https://flagcdn.com/w40/${code.slice(0, 2).toLowerCase()}.png`;
        flagImg.onerror = function () {
            this.src = `https://placehold.co/40x40?text=${code.slice(0, 2).toUpperCase()}`;
        };
    }
}

/**
 * Fetch Historical Data
 */
async function fetchHistory() {
    const endDate = new Date().toISOString().split('T')[0];
    const startDateObj = new Date();
    startDateObj.setDate(startDateObj.getDate() - state.days);
    const startDate = startDateObj.toISOString().split('T')[0];

    try {
        const response = await fetch(`${CONFIG.API_BASE}/${startDate}..${endDate}?from=${state.base}&to=${state.target}`);
        const data = await response.json();
        return data.rates;
    } catch (error) {
        console.error('Error fetching history:', error);
        return null;
    }
}

/**
 * Render/Update Chart
 */
async function updateChart() {
    const history = await fetchHistory();
    if (!history) return;

    const labels = Object.keys(history);
    const dataPoints = Object.values(history).map(rate => rate[state.target]);

    if (state.chart) {
        state.chart.destroy();
    }

    const ctx = elements.chartCanvas.getContext('2d');

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(17, 82, 212, 0.5)'); // Primary color
    gradient.addColorStop(1, 'rgba(17, 82, 212, 0.0)');

    state.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${state.base} to ${state.target}`,
                data: dataPoints,
                borderColor: '#1152d4',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#fff',
                pointBorderColor: '#1152d4',
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(16, 22, 34, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: (context) => ` ${context.parsed.y} ${state.target}`
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(148, 163, 184, 0.1)'
                    },
                    ticks: {
                        color: '#94a3b8'
                    }
                }
            }
        }
    });
}

function setupEventListeners() {
    elements.swapBtn.addEventListener('click', () => {
        [state.base, state.target] = [state.target, state.base];

        // Update UI
        updateFlagAndText('base', state.base);
        updateFlagAndText('target', state.target);

        updateChart();
    });

    elements.timeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            elements.timeButtons.forEach(b => {
                b.classList.remove('bg-white', 'dark:bg-slate-700', 'shadow-sm', 'font-bold');
                b.classList.add('text-slate-500', 'font-medium');
            });
            btn.classList.add('bg-white', 'dark:bg-slate-700', 'shadow-sm', 'font-bold');
            btn.classList.remove('text-slate-500', 'font-medium');

            state.days = parseInt(btn.dataset.days);
            updateChart();
        });
    });
}

document.addEventListener('DOMContentLoaded', init);
