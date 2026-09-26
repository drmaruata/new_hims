import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import request from 'supertest';

import { DatabaseService } from '@hims/database';
import { HealthController } from './health.controller.js';

/**
 * Exercises the real Nest container, so this file is also the regression test
 * for the Jest setup itself: `reflect-metadata` must be loaded before the DI
 * container is built, and `emitDecoratorMetadata` must be able to read
 * `HealthController`'s three constructor parameter types. If either breaks, the
 * module fails to compile here rather than at deploy time.
 *
 * `DatabaseService` is replaced with a fake. A unit spec must not open a
 * connection pool, and under RLS an unscoped query would return zero rows
 * rather than an error, so a "working" readiness check against a real database
 * would prove nothing anyway.
 */
describe('HealthController', () => {
  let app: INestApplication;
  let ping: jest.Mock<Promise<boolean>, []>;

  const buildApp = async (databaseReachable: boolean) => {
    ping = jest.fn().mockResolvedValue(databaseReachable);

    const moduleRef = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [{ provide: DatabaseService, useValue: { ping } }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  };

  afterEach(async () => {
    await app?.close();
  });

  describe('GET /health (liveness)', () => {
    it('answers from process state alone, without touching the database', async () => {
      await buildApp(/* databaseReachable */ false);

      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.body).toMatchObject({ status: 'ok', service: 'hims-api' });
      expect(typeof response.body.uptimeSeconds).toBe('number');
      // Liveness must never depend on PostgreSQL, or a slow database restarts
      // the whole cluster exactly when it is least able to absorb reconnects.
      expect(ping).not.toHaveBeenCalled();
    });
  });

  describe('GET /health/ready (readiness)', () => {
    it('reports ready when the database answers', async () => {
      await buildApp(true);

      const response = await request(app.getHttpServer()).get('/health/ready').expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.info.database).toMatchObject({ status: 'up' });
      expect(ping).toHaveBeenCalledTimes(1);
    });

    it('reports not ready, with a 503, when the database does not answer', async () => {
      await buildApp(false);

      const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

      expect(response.body.status).toBe('error');
      // Terminus reports failing indicators under `error`; `info` is reserved
      // for the ones that passed, so it is absent when nothing passed.
      expect(response.body.error.database).toMatchObject({ status: 'down' });
      expect(response.body.info).toEqual({});
    });

    it('does not claim readiness when the ping rejects outright', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [TerminusModule],
        controllers: [HealthController],
        providers: [
          {
            provide: DatabaseService,
            useValue: { ping: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) },
          },
        ],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();

      const response = await request(app.getHttpServer()).get('/health/ready').expect(503);

      expect(response.body.status).toBe('error');
      expect(response.body.error.database).toMatchObject({
        status: 'down',
        message: 'ECONNREFUSED',
      });
    });
  });
});
