module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--bg-primary)",
        secondary: "var(--bg-secondary)",
        sidebar: "var(--bg-sidebar)",
        "bubble-out": "var(--bg-bubble-out)",
        "bubble-in": "var(--bg-bubble-in)",
        "text-main": "var(--text-primary)",
        "text-muted": "var(--text-secondary)",
        border: "var(--border-color)",
        hover: "var(--hover-color)",
        active: "var(--active-color)",
        "input-bg": "var(--input-bg)",
      },
    },
  },
  plugins: [],
}