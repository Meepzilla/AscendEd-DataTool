import type {Config} from 'tailwindcss';

// Tailwind CSS configuration file.
// This file defines how Tailwind generates its utility classes,
// including theme customization, content scanning, and plugins.
export default {
  // Configures dark mode strategy.
  // 'class' means dark mode can be toggled by adding/removing the 'dark' class from the HTML element.
  darkMode: ['class'],
  // Specifies the files to scan for Tailwind classes.
  // Tailwind will only include CSS for classes found in these files during compilation.
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  // Customizes the default Tailwind theme.
  // This allows extending or overriding Tailwind's default design tokens (e.g., colors, fonts, spacing).
  theme: {
    // 'extend' allows adding new theme values without overriding existing ones.
    extend: {
      // Short screens, such as a phone turned sideways: `short:` styles keep bars to one line there.
      screens: {
        short: { raw: '(max-height: 560px)' },
      },
      // Custom font families.
      fontFamily: {
        body: ['Inter', 'sans-serif'],
        headline: ['Inter', 'sans-serif'],
        code: ['monospace'],
      },
      // Custom color palette.
      // HSL values are used with CSS variables for dynamic theming (e.g., light/dark mode).
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Custom chart-specific colors.
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        // Custom sidebar-specific colors.
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      // Custom border radius values.
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      // Custom keyframe animations.
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      // Custom animation utilities.
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      // Custom max-width utility.
      maxWidth: {
        '6xl': '72rem', // Added max-width as per proposal
      }
    },
  },
  // Tailwind CSS plugins.
  // These extend Tailwind's functionality with new features or utilities.
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
