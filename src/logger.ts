type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
}

const LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

function emit(level: LogLevel, threshold: number, message: string, meta?: Record<string, unknown>) {
  if (LEVELS.indexOf(level) < threshold) {
    return;
  }

  const payload = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  });

  process.stderr.write(payload + "\n");
}

export function createLogger(level: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info"): Logger {
  const threshold = Math.max(0, LEVELS.indexOf(level));

  return {
    debug: (message, meta) => emit("debug", threshold, message, meta),
    info: (message, meta) => emit("info", threshold, message, meta),
    warn: (message, meta) => emit("warn", threshold, message, meta),
    error: (message, meta) => emit("error", threshold, message, meta),
  };
}
