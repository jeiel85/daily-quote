export const THEMES = [
  { id: 'random', labelKey: 'themes.random', icon: '🎲' },
  { id: 'motivation', labelKey: 'themes.motivation', icon: '🔥' },
  { id: 'comfort', labelKey: 'themes.comfort', icon: '🌿' },
  { id: 'humor', labelKey: 'themes.humor', icon: '😄' },
  { id: 'success', labelKey: 'themes.success', icon: '🏆' },
  { id: 'business', labelKey: 'themes.business', icon: '💼' },
  { id: 'love', labelKey: 'themes.love', icon: '❤️' },
  { id: 'philosophy', labelKey: 'themes.philosophy', icon: '🏛️' },
  { id: 'wisdom', labelKey: 'themes.wisdom', icon: '🦉' },
  { id: 'life', labelKey: 'themes.life', icon: '🌱' },
];

export const CARD_STYLES = [
  { id: 'classic', labelKey: 'cardStyles.classic' },
  { id: 'modern', labelKey: 'cardStyles.modern' },
  { id: 'minimal', labelKey: 'cardStyles.minimal' },
  { id: 'bold', labelKey: 'cardStyles.bold' },
  { id: 'elegant', labelKey: 'cardStyles.elegant' },
  { id: 'nature', labelKey: 'cardStyles.nature' },
  { id: 'dark', labelKey: 'cardStyles.dark' },
];

export const LANGUAGES = [
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'English' },
  { id: 'ja', label: '日本語' },
  { id: 'zh', label: '中文' },
];

export const THEME_SEED_POOLS: Record<string, string[]> = {
  motivation:  ['mountain-peak', 'summit-climb', 'sunrise-trail', 'marathon-run', 'endurance-sport'],
  comfort:     ['calm-forest', 'cozy-morning', 'green-meadow', 'soft-rain', 'warm-cottage'],
  humor:       ['colorful-confetti', 'playful-balloons', 'bright-carnival', 'fun-festival', 'happy-dog'],
  success:     ['city-lights', 'trophy-gold', 'office-highrise', 'graduation-day', 'podium-winner'],
  business:    ['modern-office', 'boardroom-glass', 'city-skyline', 'laptop-desk', 'corporate-tower'],
  love:        ['golden-sunset', 'red-roses', 'romantic-evening', 'pink-blossom', 'heart-bokeh'],
  philosophy:  ['ancient-library', 'stone-archway', 'misty-lake', 'greek-temple', 'lone-lighthouse'],
  wisdom:      ['autumn-leaves', 'old-bookshelf', 'meditation-zen', 'owl-forest', 'wise-elder'],
  life:        ['nature-sky', 'spring-flowers', 'ocean-horizon', 'forest-path', 'starry-night'],
};

export const CARD_BACKGROUNDS = [
  { name: 'indigo-deep', type: 'gradient', colors: ['#312e81', '#1e1b4b'] as [string, string] },
  { name: 'purple-dream', type: 'gradient', colors: ['#7c3aed', '#4c1d95'] as [string, string] },
  { name: 'emerald-forest', type: 'gradient', colors: ['#059669', '#064e3b'] as [string, string] },
  { name: 'crimson-passion', type: 'gradient', colors: ['#b91c1c', '#7f1d1d'] as [string, string] },
  { name: 'amber-glow', type: 'gradient', colors: ['#d97706', '#92400e'] as [string, string] },
  { name: 'ocean-blue', type: 'gradient', colors: ['#2563eb', '#1e40af'] as [string, string] },
  { name: 'pink-blossom', type: 'gradient', colors: ['#db2777', '#9d174d'] as [string, string] },
  { name: 'cyan-wave', type: 'gradient', colors: ['#0891b2', '#155e75'] as [string, string] },
  { name: 'slate-midnight', type: 'gradient', colors: ['#0f172a', '#020617'] as [string, string] },
  { name: 'teal-depth', type: 'gradient', colors: ['#0f766e', '#134e4a'] as [string, string] },
  { name: 'rose-elegance', type: 'gradient', colors: ['#be123c', '#881337'] as [string, string] },
  { name: 'lime-fresh', type: 'gradient', colors: ['#65a30d', '#3f6212'] as [string, string] },
];
