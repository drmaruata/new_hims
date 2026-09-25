import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { loadEnv } from '@hims/config';

import { DatabaseModule } from '@hims/database';
import { AuthModule } from './core/auth/auth.module.js';
import { HealthModule } from './core/health/health.module.js';
import { HttpExceptionFilter } from './core/filters/http-exception.filter.js';
import { TransformInterceptor } from './core/interceptors/transform.interceptor.js';
import { CorrelationIdMiddleware } from './core/middleware/correlation-id.middleware.js';
import { JwtAuthGuard } from './core/auth/guards/jwt-auth.guard.js';

import { AuditModule } from './modules/audit/audit.module.js';
import { AuthorizationModule } from './modules/authorization/authorization.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { CommandCenterModule } from './modules/command-center/command-center.module.js';
import { DepartmentModule } from './modules/department/department.module.js';
import { EmergencyModule } from './modules/emergency/emergency.module.js';
import { EncounterModule } from './modules/encounter/encounter.module.js';
import { EmrModule } from './modules/emr/emr.module.js';
import { FacilityModule } from './modules/facility/facility.module.js';
import { IcuModule } from './modules/icu/icu.module.js';
import { InsuranceModule } from './modules/insurance/insurance.module.js';
import { IntegrationModule } from './modules/integration/integration.module.js';
import { IpdModule } from './modules/ipd/ipd.module.js';
import { LisModule } from './modules/lis/lis.module.js';
import { OpdModule } from './modules/opd/opd.module.js';
import { OtModule } from './modules/ot/ot.module.js';
import { PatientModule } from './modules/patient/patient.module.js';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module.js';
import { QualityModule } from './modules/quality/quality.module.js';
import { RisModule } from './modules/ris/ris.module.js';
import { TenantModule } from './modules/tenant/tenant.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // `.env` is loaded for convenience, but every value can be injected by the
      // platform (Kubernetes ConfigMap/Secret, ECS task definition), which take
      // precedence over the file.
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
      // Validate with the same schema `loadEnv` uses, so `ConfigService.get`
      // returns coerced booleans and numbers rather than raw strings. The
      // process has already validated once in main.ts; this makes every
      // injected `ConfigService` read the same, checked values.
      validate: (config) => loadEnv(config as NodeJS.ProcessEnv),
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          // Per-instance token bucket, sized for a single API pod. A distributed
          // limit is enforced at the gateway; this is a backstop for a single
          // process and must not be the only rate limit in the system.
          //
          // forRootAsync rather than forRoot so the values come from the
          // validated ConfigService instead of raw process.env strings.
          ttl: config.get<number>('RATE_LIMIT_TTL_MS') ?? 60_000,
          limit: config.get<number>('RATE_LIMIT_MAX') ?? 300,
        },
      ],
    }),

    // Platform
    DatabaseModule,
    AuthModule,
    HealthModule,

    // Organization and identity
    TenantModule,
    FacilityModule,
    DepartmentModule,
    AuthorizationModule,

    // Clinical domains
    PatientModule,
    EncounterModule,
    OpdModule,
    IpdModule,
    LisModule,
    RisModule,
    EmergencyModule,
    OtModule,
    IcuModule,
    PharmacyModule,
    EmrModule,

    // Financial and support domains
    BillingModule,
    InsuranceModule,
    QualityModule,
    AuditModule,
    IntegrationModule,
    CommandCenterModule,
    AiModule,
  ],
  providers: [
    // Order matters: authenticate before throttling so a blocked request is
    // attributed to a principal, then rate-limit, then shape the response.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Correlation id first so every downstream log, error and response carries
    // it, including for requests rejected before the guard runs.
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes({ path: '*splat', method: RequestMethod.ALL });
  }
}
