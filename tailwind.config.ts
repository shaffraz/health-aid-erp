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
        ink: "#224770",
        lagoon: {
          50: "#efefef",
          100: "#efefef",
          500: "#0eb6ef",
          600: "#0eb6ef",
          700: "#224770"
        },
        care: {
          50: "#efefef",
          100: "#efefef",
          500: "#84bc3f",
          600: "#84bc3f",
          700: "#224770"
        }
      },
      boxShadow: {
        soft: "0 20px 50px -32px rgba(0, 0, 0, 0.25)"
      }
    }
  },
  plugins: []
};

export default config;
