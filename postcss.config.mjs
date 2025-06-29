/** @type {import('postcss-load-config').Config} */
// PostCSS configuration file.
// PostCSS is a tool for transforming CSS with JavaScript plugins.
const config = {
  // `plugins` define the PostCSS plugins to be used.
  plugins: {
    // Tailwind CSS plugin for PostCSS.
    // This enables Tailwind's utility-first CSS framework to be processed.
    tailwindcss: {},
  },
};

export default config;
