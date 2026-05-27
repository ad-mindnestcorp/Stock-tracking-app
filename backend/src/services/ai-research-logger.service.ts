import { promises as fs } from 'fs';
import path from 'path';

const LOGS_DIR = path.resolve(__dirname, '..', '..', '..', 'logs');

interface LogEntry {
  timestamp: string;
  symbol: string;
  section: string;
  model: string;
  useWebSearch: boolean;
  prompt: string;
  rawResponse: string;
  parsedData: unknown;
  latencyMs: number;
  promptTokens?: number | string;
  completionTokens?: number | string;
}

async function ensureLogsDirectory(): Promise<void> {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  } catch (err) {
    console.error(`[ai-logger] Failed to create logs directory: ${err instanceof Error ? err.message : err}`);
  }
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTimestamp(date: Date): string {
  return date.toISOString();
}

function truncateIfLong(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '\n... (truncated)';
}

export async function logAIResearch(entry: LogEntry): Promise<void> {
  try {
    await ensureLogsDirectory();

    const now = new Date();
    const dateStr = formatDate(now);
    const filename = `ai-research-${dateStr}.md`;
    const filepath = path.join(LOGS_DIR, filename);

    // Format log entry as markdown
    const logContent = `
---

## ${entry.section.toUpperCase()} | ${entry.symbol} | ${entry.timestamp}

**Model:** ${entry.model}  
**Web Search:** ${entry.useWebSearch ? 'Yes' : 'No'}  
**Latency:** ${entry.latencyMs}ms  
**Prompt Tokens:** ${entry.promptTokens ?? 'N/A'}  
**Completion Tokens:** ${entry.completionTokens ?? 'N/A'}

### Prompt
\`\`\`
${truncateIfLong(entry.prompt, 1000)}
\`\`\`

### Raw API Response
\`\`\`json
${entry.rawResponse}
\`\`\`

### Parsed Data
\`\`\`json
${JSON.stringify(entry.parsedData, null, 2)}
\`\`\`

`;

    // Append to daily log file
    await fs.appendFile(filepath, logContent, 'utf8');
    console.log(`[ai-logger] Logged ${entry.section} for ${entry.symbol} to ${filename}`);
  } catch (err) {
    console.error(`[ai-logger] Failed to log AI research: ${err instanceof Error ? err.message : err}`);
  }
}
