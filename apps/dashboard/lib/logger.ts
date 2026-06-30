type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL = LEVELS[(process.env.FA_LOG_LEVEL as Level) ?? 'info'] ?? LEVELS.info;

function emit(level: Level, msg: string, fields?: Record<string, unknown>): void {
  if (LEVELS[level] < MIN_LEVEL) return;
  const record = { level, time: new Date().toISOString(), msg, ...fields };
  const line = JSON.stringify(record);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/**
 * Minimal dependency-free structured logger. Emits one JSON object per line,
 * which is what log shippers (Datadog, Loki, CloudWatch) expect. Honors
 * `FA_LOG_LEVEL`.
 */
export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit('debug', msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
};
