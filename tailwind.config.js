/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "primary": "#00ffff",
        "background-dark": "#000000",
        "neutral-dark": "#0a1a1a",
        "border-dark": "#1a3333",
      },
      fontFamily: {
        "display": ["Space Grotesk", "sans-serif"]
      },
    },
  },
  plugins: [],
}
