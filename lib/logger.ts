type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogContext {
  [key: string]: unknown
}

function formatMessage(module: string, operation: string, message: string): string {
  return `[${module}][${operation}] ${message}`
}

function log(level: LogLevel, module: string, operation: string, message: string, ctx?: LogContext) {
  const formatted = formatMessage(module, operation, message)
  const args = ctx ? [formatted, ctx] : [formatted]

  if (level === 'error') {
    console.error(...args)
  } else if (level === 'warn') {
    console.warn(...args)
  } else if (level === 'debug') {
    // Only emit debug logs in development
    if (process.env.NODE_ENV !== 'production') {
      console.debug(...args)
    }
  } else {
    console.log(...args)
  }
}

export function createLogger(module: string) {
  return {
    info: (operation: string, message: string, ctx?: LogContext) =>
      log('info', module, operation, message, ctx),
    warn: (operation: string, message: string, ctx?: LogContext) =>
      log('warn', module, operation, message, ctx),
    error: (operation: string, message: string, ctx?: LogContext) =>
      log('error', module, operation, message, ctx),
    debug: (operation: string, message: string, ctx?: LogContext) =>
      log('debug', module, operation, message, ctx),
  }
}
