import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DatabaseService } from './database.service.js';

/**
 * Global so feature modules do not re-import it.
 *
 * A controller asking for `DatabaseService` should not have to know which
 * module owns the connection pool, and a module that forgets the import fails
 * at DI resolution rather than at compile time — which is exactly the kind of
 * failure that only appears in production. Global removes the second category.
 *
 * `ConfigModule` is imported anyway, and the reason is worth stating because
 * `isGlobal: true` on the app's own `ConfigModule.forRoot()` looks like it
 * should make this redundant. Global propagation goes one way: a global module's
 * *exports* become visible to other modules, but Nest still resolves each
 * module's own provider dependencies against that module's own `imports`.
 * Without this import, `DatabaseService`'s `ConfigService` parameter is
 * unresolvable and the container throws
 * `Nest can't resolve dependencies of the DatabaseService (ConfigService, ?)`
 * before a single route is reached.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
