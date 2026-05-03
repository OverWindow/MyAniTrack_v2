import { AnimeTitleTranslationSource } from './anime.korean-title.repository';

const AI_API_URL = process.env.AI_API_URL || 'https://factchat-cloud.mindlogic.ai/v1/api/anthropic/messages';
const AI_MODEL = process.env.AI_MODEL || 'claude-sonnet-4-5-20250929';

interface AnthropicContentBlock {
  type?: string;
  text?: string;
}

interface AiApiSuccess {
  output_text?: string;
  content?: AnthropicContentBlock[];
  completion?: string;
}

interface KoreanTitleTranslationResult {
  animeId: number;
  title: string;
  subtitle?: string;
  isPrimary?: boolean;
}

function extractJsonArray(text: string): string {
  const trimmed = text.trim();

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed;
  }

  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch?.[1]) {
    return codeBlockMatch[1].trim();
  }

  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');

  if (firstBracket >= 0 && lastBracket > firstBracket) {
    return trimmed.slice(firstBracket, lastBracket + 1);
  }

  throw new Error('OpenAI response did not contain a JSON array');
}

function validateTranslations(
  sourceItems: AnimeTitleTranslationSource[],
  translations: KoreanTitleTranslationResult[]
): KoreanTitleTranslationResult[] {
  const sourceIds = new Set(sourceItems.map((item) => item.animeId));
  const seenIds = new Set<number>();

  for (const translation of translations) {
    if (!sourceIds.has(translation.animeId)) {
      throw new Error(`Unexpected animeId returned from OpenAI: ${translation.animeId}`);
    }

    if (seenIds.has(translation.animeId)) {
      throw new Error(`Duplicate animeId returned from OpenAI: ${translation.animeId}`);
    }

    if (!translation.title?.trim()) {
      throw new Error(`Missing Korean title for animeId: ${translation.animeId}`);
    }

    seenIds.add(translation.animeId);
  }

  if (seenIds.size !== sourceItems.length) {
    throw new Error(`OpenAI returned ${seenIds.size} translations for ${sourceItems.length} requested titles`);
  }

  return translations.map((translation) => ({
    animeId: translation.animeId,
    title: translation.title.trim(),
    subtitle: translation.subtitle?.trim() || '',
    isPrimary: translation.isPrimary ?? true,
  }));
}

export async function translateAnimeTitlesToKorean(
  sourceItems: AnimeTitleTranslationSource[]
): Promise<KoreanTitleTranslationResult[]> {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('AI_API_KEY is not configured');
  }

  if (sourceItems.length === 0) {
    return [];
  }

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content:
            `You translate anime titles into natural Korean titles for a Korean anime catalog.
Return JSON only.
Keep each animeId exactly once.
Use subtitle only when the title is naturally split in Korean.
If subtitle is unnecessary, return an empty string.
Preserve official or commonly used Korean naming where possible.

Return only a JSON array with objects shaped exactly like:
[{"animeId":123,"title":"...","subtitle":"","isPrimary":true}]

Translate these titles:
${JSON.stringify(sourceItems)}`
        },
      ]
    }),
  });

  if (!response.ok) {
    throw new Error(`AI request failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as AiApiSuccess;
  const outputText = (
    json.output_text ??
    json.completion ??
    json.content?.map((block) => block.text ?? '').join('\n')
  )?.trim();

  if (!outputText) {
    throw new Error('AI response was empty');
  }

  const rawJson = extractJsonArray(outputText);
  const parsed = JSON.parse(rawJson) as KoreanTitleTranslationResult[];

  if (!Array.isArray(parsed)) {
    throw new Error('AI response was not a JSON array');
  }

  return validateTranslations(sourceItems, parsed);
}
