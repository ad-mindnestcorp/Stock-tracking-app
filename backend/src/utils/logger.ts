type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  tag: string;
  message: string;
  context?: Record<string, unknown>;
}

export function log({ level, tag, message, context }: LogEntry): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    tag,
    message,
    ...(context && Object.keys(context).length > 0 ? { context } : {}),
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case 'error':
      console.error(line);
      break;
    case 'warn':
      console.warn(line);
      break;
    case 'debug':
      if (process.env.NODE_ENV !== 'production') console.debug(line);
      break;
    default:
      console.log(line);
  }
}

/** Extract a readable message from an unknown thrown value */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}

/** Extract the HTTP status code from an axios error, if present */
export function axiosStatus(err: unknown): number | undefined {
  if (
    err != null &&
    typeof err === 'object' &&
    'response' in err &&
    err.response != null &&
    typeof err.response === 'object' &&
    'status' in err.response
  ) {
    return (err.response as { status: number }).status;
  }
  return undefined;
}
