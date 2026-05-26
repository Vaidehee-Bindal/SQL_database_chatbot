export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#080b12",
        panel: "#101624",
        line: "#273145",
        violet: "#7c3aed",
        cyan: "#22d3ee",
        emerald: "#22c55e",
      },
    },
  },
  plugins: [],
};
