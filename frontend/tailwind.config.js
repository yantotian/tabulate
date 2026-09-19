/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    'bg-rose-50', 'border-rose-300', 'text-rose-800', 'bg-white', 'border-slate-200',
    'bg-slate-50', 'bg-indigo-50', 'text-indigo-700', 'bg-emerald-50', 'bg-amber-50'
  ]
}

