import { Global, Module } from '@nestjs/common';
import { DatabaseModule as SharedDatabaseModule } from '@hims/database';
import { PlatformDatabaseService } from './platform-database.service.js';

/**
 * Both database services are global.
 *
 * Re-exports the shared RLS-aware DatabaseModule and adds the integration-specific
 * PlatformDatabaseService for cross-tenant work.
 *
 * Processors live in feature modules (`@Processor` classes are discovered by
 * BullMQ, not by a module's `providers` array being referenced), so re-importing
 * a database module into each of them would be noise. Global keeps the
 * dependency visible in exactly one place instead.
 */
@Global()
@Module({
  imports: [SharedDatabaseModule],
  providers: [PlatformDatabaseService],
  exports: [SharedDatabaseModule, PlatformDatabaseService],
})
export class DatabaseModule {}
