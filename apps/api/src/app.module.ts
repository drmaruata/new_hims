import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './core/database/database.module.js';

import { PatientModule } from './modules/patient/patient.module.js';
import { OpdModule } from './modules/opd/opd.module.js';
import { IpdModule } from './modules/ipd/ipd.module.js';
import { LisModule } from './modules/lis/lis.module.js';
import { RisModule } from './modules/ris/ris.module.js';
import { EmergencyModule } from './modules/emergency/emergency.module.js';
import { OtModule } from './modules/ot/ot.module.js';
import { IcuModule } from './modules/icu/icu.module.js';
import { PharmacyModule } from './modules/pharmacy/pharmacy.module.js';
import { EmrModule } from './modules/emr/emr.module.js';
import { InsuranceModule } from './modules/insurance/insurance.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { QualityModule } from './modules/quality/quality.module.js';
import { CommandCenterModule } from './modules/command-center/command-center.module.js';
import { IntegrationModule } from './modules/integration/integration.module.js';
import { AiModule } from './modules/ai/ai.module.js';
import { AuditModule } from './modules/audit/audit.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    PatientModule,
    OpdModule,
    IpdModule,
    LisModule,
    RisModule,
    EmergencyModule,
    OtModule,
    IcuModule,
    PharmacyModule,
    EmrModule,
    InsuranceModule,
    BillingModule,
    QualityModule,
    CommandCenterModule,
    IntegrationModule,
    AiModule,
    AuditModule,
  ],
})
export class AppModule {}
