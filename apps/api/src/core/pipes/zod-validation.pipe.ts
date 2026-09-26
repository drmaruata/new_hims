import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { ZodError, type ZodType } from 'zod';

/**
 * Validates and coerces a request payload with a Zod schema. Declared per-route
 * as `@Body(new ZodValidationPipe(Schema))`, with the schema living beside the
 * controller so the rule is visible at the endpoint it governs.
 *
 * Zod is the only validator in this service: there are no class-validator DTO
 * classes, so no global `ValidationPipe` is registered.
 *
 * Unknown keys are rejected rather than silently dropped — a client sending
 * `tenantId` in the body of a write is making a mistake worth surfacing
 * (API_CONTRACT §3.3).
 *
 * Schema violations are 400, matching the contract's split between "malformed
 * or invalid request" (400) and "semantic validation failure" (422). A 422 is
 * reserved for a payload that is structurally valid but breaks a business rule,
 * which the services raise explicitly.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Request validation failed',
        details: formatIssues(result.error),
      });
    }

    return result.data;
  }
}

export function formatIssues(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}
