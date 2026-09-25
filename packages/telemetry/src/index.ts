export interface StructuredLogMeta {
  correlationId?: string;
  tenantId?: string;
  facilityId?: string;
  userId?: string;
  service?: string;
  [key: string]: any;
}

export class TelemetryLogger {
  private serviceName: string;

  constructor(serviceName = 'hims-app') {
    this.serviceName = serviceName;
  }

  public info(message: string, meta?: StructuredLogMeta): void {
    console.log(JSON.stringify({
      level: 'info',
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      message,
      ...meta,
    }));
  }

  public warn(message: string, meta?: StructuredLogMeta): void {
    console.warn(JSON.stringify({
      level: 'warn',
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      message,
      ...meta,
    }));
  }

  public error(message: string, error?: any, meta?: StructuredLogMeta): void {
    console.error(JSON.stringify({
      level: 'error',
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      message,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
      ...meta,
    }));
  }
}

export const logger = new TelemetryLogger('hims-global');
