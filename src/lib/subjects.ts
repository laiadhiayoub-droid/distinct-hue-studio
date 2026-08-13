export const SUBJECTS = [
  "Arabic",
  "Tamazight",
  "French",
  "English",
  "Philosophy",
  "History",
  "Geography",
  "Islamic Studies",
  "Natural Sciences",
  "Physics",
  "Mathematics",
] as const;

export type Subject = (typeof SUBJECTS)[number];

export const SUBJECT_META: Record<string, { short: string; coef: number }> = {
  Arabic: { short: "AR", coef: 3 },
  Tamazight: { short: "TZ", coef: 2 },
  French: { short: "FR", coef: 5 },
  English: { short: "EN", coef: 5 },
  Philosophy: { short: "PH", coef: 2 },
  History: { short: "HI", coef: 2 },
  Geography: { short: "GE", coef: 2 },
  "Islamic Studies": { short: "IS", coef: 2 },
  "Natural Sciences": { short: "NS", coef: 2 },
  Physics: { short: "PC", coef: 2 },
  Mathematics: { short: "MA", coef: 2 },
};

export const MOTIVATION = [
  "One honest attempt today beats ten perfect plans for tomorrow.",
  "Mistakes on paper today are marks saved in June.",
  "Slow is smooth, smooth is fast. Keep the rhythm.",
  "You do not need to be brilliant — you need to be consistent.",
  "Every question you get wrong is a lesson you now own.",
  "Breathe. You are more prepared than you feel.",
];

export const BADGES: Record<string, { label: string; hint: string }> = {
  streak_7: { label: "7-day streak", hint: "Study 7 days in a row" },
  quizzes_50: { label: "50 quizzes", hint: "Complete 50 quizzes" },
  improve_5: { label: "+5 points", hint: "Improve a subject average by 5/20" },
  images_10: { label: "10 scans", hint: "Upload and analyse 10 images" },
  first_quiz: { label: "First steps", hint: "Complete your first quiz" },
};
