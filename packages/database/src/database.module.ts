import { Global, Module } from '@nestjs/common';

import { DatabaseService } from './database.service.js';

/**
 * Global so feature modules do not re-import it.
 *
 * A controller asking for `DatabaseService` should not have to know which
 * module owns the connection pool, and a module that forgets the import fails
 * at DI resolution rather than at compile time — which is exactly the kind of
 * failure that only appears in production. Global removes the second category.
 */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
