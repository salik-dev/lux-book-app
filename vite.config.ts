import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  // base: process.env.NODE_ENV === 'production' ? '/lux-book-app/' : '/',
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        require('@tailwindcss/postcss'),
      ],
    },
  },
  resolve: {
    alias: {
      'react-resizable-panels': 'react-resizable-panels',
      'react-day-picker': 'react-day-picker',
      'next-themes': 'next-themes',
      'lucide-react': 'lucide-react',
      'input-otp': 'input-otp',
      'embla-carousel-react': 'embla-carousel-react',
      'cmdk': 'cmdk',
      'class-variance-authority': 'class-variance-authority',
      '@radix-ui/react-tooltip': '@radix-ui/react-tooltip',
      '@radix-ui/react-toggle': '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group': '@radix-ui/react-toggle-group',
      '@radix-ui/react-tabs': '@radix-ui/react-tabs',
      '@radix-ui/react-switch': '@radix-ui/react-switch',
      '@radix-ui/react-slot': '@radix-ui/react-slot',
      '@radix-ui/react-slider': '@radix-ui/react-slider',
      '@radix-ui/react-select': '@radix-ui/react-select',
      '@radix-ui/react-scroll-area': '@radix-ui/react-scroll-area',
      '@radix-ui/react-radio-group': '@radix-ui/react-radio-group',
      '@radix-ui/react-navigation-menu': '@radix-ui/react-navigation-menu',
      '@radix-ui/react-menubar': '@radix-ui/react-menubar',
      '@radix-ui/react-label': '@radix-ui/react-label',
      '@radix-ui/react-hover-card': '@radix-ui/react-hover-card',
      '@radix-ui/react-dropdown-menu': '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-dialog': '@radix-ui/react-dialog',
      '@radix-ui/react-context-menu': '@radix-ui/react-context-menu',
      '@radix-ui/react-collapsible': '@radix-ui/react-collapsible',
      '@radix-ui/react-checkbox': '@radix-ui/react-checkbox',
      '@radix-ui/react-avatar': '@radix-ui/react-avatar',
      '@radix-ui/react-aspect-ratio': '@radix-ui/react-aspect-ratio',
      '@radix-ui/react-alert-dialog': '@radix-ui/react-alert-dialog',
      '@radix-ui/react-accordion': '@radix-ui/react-accordion',
      '@': path.resolve(__dirname, './src'),
    },
  },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true,
      target: 'esnext',
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor and app code for better caching
            react: ['react', 'react-dom', 'react-router-dom'],
            ui: ['class-variance-authority', 'clsx', 'tailwind-merge'],
            // Add other large dependencies here
          },
        },
      },
      chunkSizeWarningLimit: 1000, // Increase chunk size warning limit
    },
    server: {
      port: 3000,
      open: true,
    },
  });