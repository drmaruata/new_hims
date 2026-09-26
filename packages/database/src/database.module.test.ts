import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DatabaseModule } from './database.module.js';
import { DatabaseService } from './database.service.js';

/**
 * ## Why this file exists
 *
 * `DatabaseService` and `DatabaseModule` compiled, type-checked, linted and
 * every other test in this package passed — while the API, the worker and the
 * integration worker all failed to boot with
 * `Nest can't resolve dependencies of the DatabaseService (?, Object)`. Two
 * independent defects combined to produce that, and neither was visible to any
 * tool in this repository before the container was actually started:
 *
 * 1. The constructor took a second parameter, `poolSizeKey = 'DATABASE_POOL_MAX'`,
 *    so each app could name its own key. TypeScript infers a string-literal
 *    default as a *literal* type, and a literal type has no runtime class, so
 *    `tsc` emitted `__metadata("design:paramtypes", [ConfigService, Object])`.
 *    Nest then looked for a provider registered under the `Object` token.
 * 2. `DatabaseModule` did not import `ConfigModule`. `isGlobal: true` on the
 *    app's own `ConfigModule.forRoot()` makes `ConfigService` available to
 *    *other* modules; it does not add it to this module's own `imports`, which
 *    is the set Nest resolves this module's providers against.
 *
 * Both are DI-graph facts, so both are tested through the DI graph. The
 * metadata assertion is kept alongside the container test because it names the
 * cause precisely: if it ever fails again, the message says "a constructor
 * parameter's type is not a class" rather than leaving you to read a Nest
 * dependency error.
 */
describe('DatabaseModule', () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    // A syntactically valid but unreachable URL. `pg.Pool` opens no socket until
    // a client is requested, and `compile()` does not fire `onModuleInit`, so
    // nothing here touches the network or depends on a real database.
    process.env.DATABASE_URL = 'postgresql://unused:unused@127.0.0.1:1/unused';
  });

  afterEach(() => {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
  });

  it('resolves DatabaseService through a real Nest container', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [DatabaseModule] }).compile();

    try {
      // `get` throws `UnknownElementException` unless the provider was actually
      // instantiated, so reaching this assertion means the container resolved
      // `ConfigService` and constructed the pool.
      expect(moduleRef.get(DatabaseService)).toBeInstanceOf(DatabaseService);
    } finally {
      // Triggers `onModuleDestroy` -> `pool.end()`, so a failed run cannot leave
      // a pool holding the process open.
      await moduleRef.close();
    }
  });

  it('only ever declares class-typed constructor parameters', () => {
    const paramTypes = Reflect.getMetadata('design:paramtypes', DatabaseService) as unknown[];

    expect(paramTypes).toHaveLength(1);
    for (const [index, paramType] of paramTypes.entries()) {
      expect(
        typeof paramType,
        `DatabaseService constructor parameter at index [${index}] has type ${String(
          paramType
        )}. Nest resolves constructor parameters by type token, so a string or a
        string-literal type (which compiles to \`Object\`) can never be injected.
        Config keys must be read inside the constructor body, not taken as
        parameters.`
      ).toBe('function');
    }
  });
});
