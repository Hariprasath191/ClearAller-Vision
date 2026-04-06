/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Poppins", "sans-serif"],
        body: ["DM Sans", "sans-serif"]
      },
      colors: {
        ink: "#132238",
        sand: "#f8f2ea",
        coral: "#ff7a59",
        mint: "#8fe3cf",
        sea: "#0f766e"
      },
      boxShadow: {
        panel: "0 24px 80px rgba(19,34,56,0.12)"
      }
    }
  },
  plugins: []
};
