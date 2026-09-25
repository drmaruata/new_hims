import { Global, Module } from '@nestjs/common';
import { DatabaseModule as SharedDatabaseModule } from '@hims/database';
import { PlatformDatabaseService } from './platform-database.service.js';

/**
 * Makes both database services available process-wide.
 *
 * The RLS-aware `DatabaseService` comes from the shared, already-global
 * `@hims/database` module; this module only adds the worker-specific
 * `PlatformDatabaseService` used for cross-tenant outbox drains. Re-providing
 * `DatabaseService` here would create a second provider for the same token and
 * make which one wins depend on module load order.
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
