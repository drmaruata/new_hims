/**
 * Re-exports the shared RLS-aware DatabaseService from @hims/database.
 *
 * This file exists only so `import { DatabaseService } from './core/database/database.service.js'`
 * continues to resolve during the migration to `@hims/database`. Once all references
 * in this app have been updated, delete this file and its `database.module.ts`
 * re-export of `DatabaseService`.
 */
export { DatabaseService, type DatabaseContext } from '@hims/database';