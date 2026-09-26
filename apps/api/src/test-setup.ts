/**
 * Global Jest setup for @hims/api.
 *
 * `reflect-metadata` is not optional here. NestJS resolves constructor
 * dependencies and reads parameter types through the metadata that
 * `emitDecoratorMetadata` asks TypeScript to emit, and that metadata is only
 * available at runtime once this polyfill has been loaded. A spec that builds
 * a `TestingModule` before it loads fails with an opaque "cannot read
 * property design:paramtypes" rather than anything about configuration.
 *
 * A spec that needs only pure logic should not be made to pay for this: import
 * the unit under test directly and skip the Nest container entirely.
 */
import 'reflect-metadata';

// The database pool, Redis and Supabase are never reachable from a unit spec.
// A spec that genuinely needs one should provide its own fake rather than
// inherit a live client from the environment.
jest.setTimeout(10_000);
