/**
 * Mobile Menu Toggle Logic
 * Shared across pages if app.js is included, otherwise needs to be in specific page scripts.
 * index.html uses app.js.
 */
function setupMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');

    if (btn && menu) {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = menu.classList.contains('hidden');
            menu.classList.toggle('hidden');

            // Update ARIA
            btn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');

            // Toggle Icon
            const icon = btn.querySelector('.material-icons');
            if (icon) {
                icon.textContent = menu.classList.contains('hidden') ? 'menu' : 'close';
            }
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && !btn.contains(e.target)) {
                menu.classList.add('hidden');

                const icon = btn.querySelector('.material-icons');
                if (icon) icon.textContent = 'menu';
            }
        });
    }
}

// Ensure this runs on all pages
document.addEventListener('DOMContentLoaded', setupMobileMenu);
