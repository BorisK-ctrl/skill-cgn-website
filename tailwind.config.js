/** Tokens im Look der START 39 Landingpage: Schwarz, Anthrazit-Flächen (#2A3133), Gelb, schwarzer Text auf Gelb, keine Rundungen. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", sm: "1.5rem", lg: "2rem" }, screens: { lg: "1400px" } },
    extend: {
      colors: {
        background: "#000000",
        foreground: "#ffffff",
        card: { DEFAULT: "#2A3133", foreground: "#ffffff" },
        popover: { DEFAULT: "#2A3133", foreground: "#ffffff" },
        primary: { DEFAULT: "#fbff00", foreground: "#000000" },
        secondary: { DEFAULT: "#4a5a5f", foreground: "#ffffff" },
        muted: { DEFAULT: "#5a6a6f", foreground: "#b0b8bc" },
        accent: { DEFAULT: "#fbff00", foreground: "#000000" },
        destructive: { DEFAULT: "#ff4444", foreground: "#ffffff" },
        border: "#3a4547",
        input: "#3a4547",
        ring: "#fbff00",
        black: "#000000",
        yellow: "#FBFF00",
        anthracite: "#2A3133",
        line: "#1E2224",
      },
      fontFamily: {
        display: ["'Bebas Neue'", "Impact", "sans-serif"],
        sans: ["'Space Grotesk'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      maxWidth: { site: "1180px" },
      keyframes: {
        "slide-in-from-bottom": { from: { transform: "translateY(100%)", opacity: "0" }, to: { transform: "none", opacity: "1" } },
      },
      animation: { "slide-in-from-bottom": "slide-in-from-bottom .5s ease-out both" },
    },
  },
  plugins: [],
};
