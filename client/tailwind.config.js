/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Identidade Tenebra Leviathan: roxo neon sobre preto, detalhes em branco.
        brand: {
          DEFAULT: '#b026ff', // roxo neon
          dim: '#7c3aed',
          soft: '#9333ea',
          glow: '#c77dff',
        },
        win: '#00E28A',
        loss: '#FF4D6D',
        blueteam: '#7aa2ff',
        redteam: '#ff6b8a',
        gold: '#FFD700',
        bg: {
          DEFAULT: '#08060d', // preto arroxeado
          soft: '#0f0b18',
          card: '#150e22',
          hover: '#1e1533',
        },
        line: '#2a1f45',
      },
      boxShadow: {
        neon: '0 0 0 1px rgba(176,38,255,0.35), 0 0 24px -6px rgba(176,38,255,0.55)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
