/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./App.tsx",
    "./index.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./areaEdit/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        eb: {
          50: "#FAFAF2",
          900: "#20201B",
        },
        coral: {
          100: "#FFCFD6",
          500: "#FE4441",
        },
        tsb: "#1E3791",
        header: "hsl(237, 100%, 91%)",
        kv: {
          chrome: "#EDECE8",
        },
        gray: {
          750: "#2d3748",
          850: "#1a202c",
          950: "#0d1117",
        },
      },
      fontFamily: {
        sans: ['"Host Grotesk"', "system-ui", "sans-serif"],
        mono: ['"Host Grotesk"', "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
