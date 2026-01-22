/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            keyframes: {
                'ios26-float': {
                    '0%, 100%': { transform: 'translateY(0) scale(1)' },
                    '50%': { transform: 'translateY(-20px) scale(1.05)' },
                },
            },
            animation: {
                'ios26-float': 'ios26-float 8s ease-in-out infinite',
                'ios26-float-slow': 'ios26-float 12s ease-in-out infinite reverse',
            },
        },
    },
    plugins: [],
}
