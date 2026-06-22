import { AIResponse, IntroducedWord, AICorrection } from './types';

export function parseResponse(rawResponse: string): AIResponse {
  let content = rawResponse;
  let introducedWords: IntroducedWord[] = [];
  let corrections: AICorrection[] = [];

  try {
    const introducedResult = parseIntroducedWords(content);
    introducedWords = introducedResult.words;
    content = introducedResult.cleanedContent;
  } catch {
    // If parsing fails, keep original content
  }

  try {
    const correctionsResult = parseCorrections(content);
    corrections = correctionsResult.corrections;
    content = correctionsResult.cleanedContent;
  } catch {
    // If parsing fails, keep original content
  }

  return {
    content: content.trim(),
    introducedWords,
    corrections,
    raw: rawResponse,
  };
}

function parseIntroducedWords(content: string): {
  words: IntroducedWord[];
  cleanedContent: string;
} {
  const words: IntroducedWord[] = [];
  const regex = /<introduced_words>([\s\S]*?)<\/introduced_words>/g;
  let cleanedContent = content;
  let match;

  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      words.push({
        word: parsed.word || '',
        meaning: parsed.meaning || '',
        phonetic: parsed.phonetic || '',
        partOfSpeech: parsed.partOfSpeech || '',
        example: parsed.example || '',
        isTargetWord: parsed.isTargetWord || false,
      });
    } catch {
      // Skip malformed entries
    }
    cleanedContent = cleanedContent.replace(match[0], '');
  }

  return { words, cleanedContent };
}

function parseCorrections(content: string): {
  corrections: AICorrection[];
  cleanedContent: string;
} {
  const corrections: AICorrection[] = [];
  const regex = /<correction>([\s\S]*?)<\/correction>/g;
  let cleanedContent = content;
  let match;

  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      corrections.push({
        original: parsed.original || '',
        corrected: parsed.corrected || '',
        explanation: parsed.explanation || '',
      });
    } catch {
      // Skip malformed entries
    }
    cleanedContent = cleanedContent.replace(match[0], '');
  }

  return { corrections, cleanedContent };
}
