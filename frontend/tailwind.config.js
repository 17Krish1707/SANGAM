/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        page: '#F6F8FB',
        panel: '#FFFFFF',
        'text-primary': '#172033',
        'text-secondary': '#667085',
        accent: {
          DEFAULT: '#173F7A',
          hover: '#1E4E8C',
          tint: '#EBF2FA',
        },
        border: '#D9E1EA',
        status: {
          critical: {
            bg: '#FDECEC',
            text: '#B42318',
          },
          warning: {
            bg: '#FEF3E2',
            text: '#B54708',
          },
          good: {
            bg: '#E7F6EC',
            text: '#067647',
          },
          neutral: {
            bg: '#EEF1F5',
            text: '#475467',
          },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '8px',
        badge: '999px',
      },
      boxShadow: {
        card: '0 0 0 1px #E2E5EA',
        overlay: '0 4px 16px 0 rgba(26,34,51,0.10)',
      },
    },
  },
  plugins: [],
}
