export const AI_CONFIG = {
  webSearchModel: process.env.OPENAI_WEB_SEARCH_MODEL ?? 'gpt-4o-mini',
  chatModel: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
  temperature: parseFloat(process.env.OPENAI_TEMPERATURE ?? '0'),
  maxOutputTokens: parseInt(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? '2000', 10),
  sectionTimeoutMs: parseInt(process.env.OPENAI_SECTION_TIMEOUT_MS ?? '45000', 10),
} as const;
