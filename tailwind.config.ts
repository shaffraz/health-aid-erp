import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b1726",
        lagoon: {
          50: "#ecfeff",
          100: "#cffafe",
          500: "#06b6d4",
          600: "#0891b2",
          700: "#0e7490"
        },
        care: {
          50: "#effdf7",
          100: "#d9fbe8",
          500: "#20c997",
          600: "#0ca678",
          700: "#087f5b"
        }
      },
      boxShadow: {
        soft: "0 20px 50px -32px rgba(11, 23, 38, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
