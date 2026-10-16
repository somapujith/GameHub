// Back-compat: the Hyderabad Tycoon setting presets/limits/summary now live in the plugin
// (src/games/hyderabad-tycoon/settings.js, the single source of truth). Shell widgets such as
// GoalStepper keep importing from here.
export * from '@/games/hyderabad-tycoon/settings.js';
