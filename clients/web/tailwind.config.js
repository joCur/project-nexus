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
        // Design system colors mapped from design tokens
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#1e3a8a',
        },
        secondary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7c2d12',
          800: '#6b21a8',
          900: '#581c87',
        },
        success: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        info: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        neutral: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        // Semantic colors for consistent usage
        'canvas-base': '#f9fafb',
        'card-background': '#ffffff',
        'text-primary': '#111827',
        'text-secondary': '#374151',
        'text-tertiary': '#6b7280',
        'border-default': '#e5e7eb',
        'border-focus': '#2563eb',
        'ai-primary': '#7c3aed',
        'ai-light': '#ede9fe',
        'connection-strong': '#8b5cf6',
        'connection-medium': '#a78bfa',
        'connection-weak': '#c4b5fd',
        
        // AI gradient colors
        'ai-gradient-start': '#8b5cf6',
        'ai-gradient-end': '#7c3aed',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Inconsolata', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.5' }],
        lg: ['1.125rem', { lineHeight: '1.5' }],
        xl: ['1.25rem', { lineHeight: '1.5' }],
        '2xl': ['1.5rem', { lineHeight: '1.375' }],
        '3xl': ['1.875rem', { lineHeight: '1.25' }],
        '4xl': ['2.25rem', { lineHeight: '1.25' }],
      },
      fontWeight: {
        light: '300',
        regular: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      spacing: {
        0: '0px',
        1: '0.25rem',
        2: '0.5rem',
        3: '0.75rem',
        4: '1rem',
        5: '1.25rem',
        6: '1.5rem',
        7: '1.75rem',
        8: '2rem',
        10: '2.5rem',
        12: '3rem',
        16: '4rem',
        20: '5rem',
        24: '6rem',
        32: '8rem',
        40: '10rem',
        48: '12rem',
        56: '14rem',
        64: '16rem',
        // Custom spacing
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        none: '0px',
        sm: '0.125rem',
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        full: '9999px',
      },
      boxShadow: {
        none: '0 0 #0000',
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
        fast: '100ms',
        slow: '300ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
        'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
        'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-up': 'slideUp 300ms ease-out',
        'bounce-gentle': 'bounceGentle 2s infinite',
        'spin-slow': 'spin 2s linear infinite',
        // Canvas-specific animations
        'canvas-card-enter': 'canvasCardEnter 400ms ease-out',
        'canvas-card-exit': 'canvasCardExit 200ms ease-in',
        'canvas-connection-draw': 'canvasConnectionDraw 600ms ease-out',
        'canvas-ai-pulse': 'canvasAiPulse 2000ms ease-in-out infinite',
        'canvas-zoom': 'canvasZoom 300ms ease-out',
        'canvas-pan': 'canvasPan 150ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        // Canvas-specific keyframes
        canvasCardEnter: {
          '0%': { opacity: '0', transform: 'scale(0.8)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        canvasCardExit: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.8)' },
        },
        canvasConnectionDraw: {
          '0%': { strokeDashoffset: '100%' },
          '100%': { strokeDashoffset: '0%' },
        },
        canvasAiPulse: {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        canvasZoom: {
          '0%': { transform: 'var(--zoom-from, scale(1))' },
          '100%': { transform: 'var(--zoom-to, scale(1))' },
        },
        canvasPan: {
          '0%': { transform: 'var(--pan-from, translate(0, 0))' },
          '100%': { transform: 'var(--pan-to, translate(0, 0))' },
        },
      },
      // Accessibility and design system specific configurations
      minHeight: {
        'touch': '44px', // Minimum touch target size
      },
      minWidth: {
        'touch': '44px', // Minimum touch target size
      },
      ringWidth: {
        DEFAULT: '2px',
      },
      ringOffsetWidth: {
        DEFAULT: '2px',
      },
      ringColor: {
        DEFAULT: '#2563eb',
      },
      
      // Canvas-specific utilities
      // Canvas card sizing - extending existing width/height
      width: {
        ...{
          'canvas-card-min': '200px',
          'canvas-card-default': '300px',
          'canvas-card-max': '600px',
        }
      },
      height: {
        ...{
          'canvas-card-min': '120px',
          'canvas-card-default': '200px',
          'canvas-card-max': '400px',
        }
      },
      
      // Canvas zoom levels - extending existing scale
      scale: {
        ...{
          '25': '0.25',
          '35': '0.35',
          '45': '0.45',
          '55': '0.55',
          '65': '0.65',
          '85': '0.85',
          '175': '1.75',
          '200': '2.0',
          '225': '2.25',
          '250': '2.5',
          '275': '2.75',
          '300': '3.0',
          '325': '3.25',
          '350': '3.5',
          '375': '3.75',
          '400': '4.0',
        }
      },
      
      // Connection stroke widths
      strokeWidth: {
        'connection-thin': '1',
        'connection-medium': '2',
        'connection-thick': '3',
      },
      
      // Animation durations for canvas - extending existing animationDuration  
      animationDuration: {
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '400': '400ms',
        '600': '600ms',
        '2000': '2000ms',
      },
      
      // Custom timing functions - extending existing animationTimingFunction
      animationTimingFunction: {
        'spring': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'ease-out-back': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
};