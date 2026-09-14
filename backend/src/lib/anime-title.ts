export type AnimeTitleLanguage = 'ko' | 'en' | 'ja';

export type AnimeTitleValues = {
  korean?: string | null;
  english?: string | null;
  romaji?: string | null;
  userPreferred?: string | null;
  native?: string | null;
};

function firstTitle(values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim())?.trim() ?? null;
}

export function pickAnimeTitle(values: AnimeTitleValues, language: AnimeTitleLanguage) {
  if (language === 'ko') {
    return firstTitle([
      values.korean,
      values.english,
      values.romaji,
      values.userPreferred,
      values.native,
    ]);
  }

  if (language === 'en') {
    return firstTitle([
      values.english,
      values.romaji,
      values.userPreferred,
      values.native,
      values.korean,
    ]);
  }

  return firstTitle([
    values.native,
    values.romaji,
    values.userPreferred,
    values.english,
    values.korean,
  ]);
}
