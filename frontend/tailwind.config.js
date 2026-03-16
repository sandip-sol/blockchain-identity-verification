/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './pages/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#fff2ea',
                    100: '#ffe1d3',
                    200: '#ffc0a6',
                    300: '#ff9970',
                    400: '#ff6d33',
                    500: '#ff4d00',
                    600: '#e64600',
                    700: '#c33a00',
                    800: '#9a2f05',
                    900: '#7c2808',
                    950: '#3e1202',
                },
                secondary: {
                    50: '#f7f7f8',
                    100: '#ededf0',
                    200: '#d7d8dd',
                    300: '#b3b5be',
                    400: '#8b8e9c',
                    500: '#6b6f80',
                    600: '#555869',
                    700: '#444657',
                    800: '#2d2f3c',
                    900: '#1a1b23',
                    950: '#0b0c10',
                },
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                foreground: 'hsl(var(--foreground))',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
                'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
                'glow-conic': 'conic-gradient(from 180deg at 50% 50%, #ff4d00 0deg, #0b0c10 180deg, #ff4d00 360deg)',
            },
            backdropBlur: {
                xs: '2px',
            },
            animation: {
                'fade-in': 'fadeIn 0.5s ease-in',
                'slide-up': 'slideUp 0.5s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'float': 'float 6s ease-in-out infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
                'shimmer': 'shimmer 2s linear infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(20px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-20px)' },
                },
                glow: {
                    '0%': { boxShadow: '0 0 10px rgba(255, 77, 0, 0.15), 0 0 16px rgba(255, 77, 0, 0.08)' },
                    '100%': { boxShadow: '0 0 24px rgba(255, 77, 0, 0.35), 0 0 40px rgba(255, 77, 0, 0.18)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                }
            }
        },
    },
    plugins: [],
}
