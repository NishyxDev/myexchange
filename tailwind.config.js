/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./*.html", "./assets/js/*.js"],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "#1152d4",
                "accent-gold": "#D4AF37",
                "background-light": "#f6f6f8",
                "background-dark": "#101622",
            },
            fontFamily: {
                "display": ["Inter", "sans-serif"]
            },
            borderRadius: {
                "DEFAULT": "0.25rem",
                "lg": "0.5rem",
                "xl": "0.75rem",
                "full": "9999px"
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms')({
            strategy: 'class',
        }),
    ],
}
