/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    // VideoTable에서 사용하는 클래스들 (동적 클래스가 아니지만 purge 방지)
    'w-32',
    'h-20',
    'w-full',
    'h-full',
    'object-cover',
    'rounded',
    'transition-transform',
    'group-hover:scale-105',
    'absolute',
    'inset-0',
    'bg-black',
    'bg-opacity-0',
    'group-hover:bg-opacity-20',
    'transition-opacity',
    'line-clamp-2',
  ],
}

































































































