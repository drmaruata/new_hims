// Minimal structured log emitter.
//
// This is a console shim, not the production sink: the API wires Sentry and
// OpenTelemetry through `@hims/telemetry`'s initialiser, and this class exists so
// a module with no injected logger still emits parseable lines. It deliberately
// has no dependencies so every package can use it, including the browser
// bundles where Sentry is not loaded.

export interface StructuredLogMeta {
  correlationId?: string;
  tenantId?: string;
  facilityId?: string;
  userId?: string;
  service?: string;
  // `unknown`, not `any`: a log bag is assembled by callers, and `any` would
  // let an untyped value reach `JSON.stringify` believing it is serialisable.
  [key: string]: unknown;
}

type LogLevel = 'info' | 'warn' | 'error';

/** The envelope every line carries, whatever the caller's bag contains. */
interface LogEnvelope extends StructuredLogMeta {
  level: LogLevel;
  service: string;
  timestamp: string;
  message: string;
}

/**
 * Reduce a caught value to something safe to serialise.
 *
 * An `Error` stringifies to `{}` under `JSON.stringify` — `message` and `stack`
 * are non-enumerable — so logging one raw produces a useless empty object. Any
 * other value is passed through untouched; `JSON.stringify` drops functions and
 * symbols and throws on a circular reference, which is the caller's problem to
 * avoid, not something to paper over here.
 */
function serialiseError(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      // `cause` is an ordinary property but holds the chain that actually
      // explains a wrapped failure, and it is the first thing missing from a
      // log line during an incident.
      cause:
        value.cause instanceof Error ? `${value.cause.name}: ${value.cause.message}` : value.cause,
      stack: value.stack,
    };
  }
  return value;
}

export class TelemetryLogger {
  private readonly serviceName: string;

  constructor(serviceName = 'hims-app') {
    this.serviceName = serviceName;
  }

  /**
   * `meta` is spread *first* so a caller's bag can add context but can never
   * overwrite `level`, `service`, `timestamp` or `message`. The reverse order
   * would let a stray `meta.level` relabel an info line as an error, which in an
   * incident review is indistinguishable from a real one.
   */
  private emit(
    level: LogLevel,
    message: string,
    meta: StructuredLogMeta,
    sink: (line: string) => void
  ): void {
    const envelope: LogEnvelope = {
      ...meta,
      level,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      message,
    };
    sink(JSON.stringify(envelope));
  }

  public info(message: string, meta?: StructuredLogMeta): void {
    this.emit('info', message, meta ?? {}, console.log);
  }

  public warn(message: string, meta?: StructuredLogMeta): void {
    this.emit('warn', message, meta ?? {}, console.warn);
  }

  public error(message: string, error?: unknown, meta?: StructuredLogMeta): void {
    this.emit('error', message, { ...meta, error: serialiseError(error) }, console.error);
  }
}

export const logger = new TelemetryLogger('hims-global');
