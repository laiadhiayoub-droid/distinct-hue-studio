export const SUBJECTS = [
  "Mathematics",
  "Physics",
  "Natural Sciences",
  "Arabic",
  "French",
  "English",
  "Spanish",
  "German",
  "Italian",
  "Tamazight",
  "Philosophy",
  "History",
  "Geography",
  "Islamic Studies",
] as const;

export type Subject = (typeof SUBJECTS)[number];

export const LANGUAGE_SUBJECTS = new Set<string>([
  "Arabic", "French", "English", "Spanish", "German", "Italian", "Tamazight",
]);
