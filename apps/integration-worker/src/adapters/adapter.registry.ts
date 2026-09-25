import { Injectable } from '@nestjs/common';
import { HttpAdapter } from './http.adapter.js';
import type { IntegrationAdapter } from './adapter.types.js';

@Injectable()
export class AdapterRegistry {
  constructor(private readonly httpAdapter: HttpAdapter) {}

  getAdapter(type: string): IntegrationAdapter | null {
    switch (type) {
      case 'HTTP':
      case 'REST':
      case 'WEBHOOK':
      case 'FHIR':
      case 'HL7':
        return this.httpAdapter;
      default:
        return null;
    }
  }
}
