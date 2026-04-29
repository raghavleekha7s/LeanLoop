import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: '#0B1220',
          surface: '#111827',
          muted: '#1F2937',
          line: '#273244',
          text: '#E5E7EB',
          subtle: '#94A3B8',
          accent: '#22C55E',
          accentHi: '#16A34A',
          warn: '#F59E0B',
          danger: '#EF4444',
        },
      },
    },
  },
  plugins: [],
};

export default config;
