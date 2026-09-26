import request from 'supertest';

import { createE2eApp, GLOBAL_PREFIX, type E2eApp } from './support/e2e-app.js';

/**
 * Integration tests for the HTTP contract every client is written against.
 *
 * These boot a real Nest application and make real HTTP requests, so what is
 * asserted is what a browser or mobile client would actually receive: the
 * version prefix, the response envelope, the correlation id and the error
 * envelope. Unit tests cannot catch a prefix change, because they never build
 * an app; and a controller test that builds its own app would only prove the
 * test's configuration, not the deployed one.
 *
 * What this suite deliberately does not cover is stated in
 * `test/support/e2e-app.ts`: authentication, rate limiting and anything needing
 * PostgreSQL, Redis or Supabase.
 */
describe('HTTP contract', () => {
  let context: E2eApp;

  beforeAll(async () => {
    context = await createE2eApp();
  });

  afterAll(async () => {
    await context?.app.close();
  });

  const server = () => context.httpServer;

  describe('version prefix', () => {
    it('serves the liveness probe under the version prefix', async () => {
      const response = await request(server()).get(`/${GLOBAL_PREFIX}/health`).expect(200);

      expect(response.body).toMatchObject({ data: { status: 'ok', service: 'hims-api' } });
    });

    it('does not serve the route unprefixed', async () => {
      // A client that drops the prefix must get a 404 rather than a working
      // endpoint, so a versioning mistake surfaces as a break instead of
      // silently keeping the old path alive.
      const response = await request(server()).get('/health').expect(404);

      // The body is empty here rather than the error envelope: a path that
      // matches no route is rejected by the HTTP layer before Nest's exception
      // filter is ever reached. The enveloped 404 is asserted separately, on a
      // path that *is* under the prefix.
      expect(response.body).toEqual({});
    });
  });

  describe('response envelope', () => {
    it('wraps a successful payload in { data, meta } with a correlation id', async () => {
      const response = await request(server())
        .get(`/${GLOBAL_PREFIX}/health`)
        .set('X-Correlation-Id', 'contract-check-1')
        .expect(200);

      expect(response.body).toEqual({
        data: {
          status: 'ok',
          service: 'hims-api',
          // Process-local and wall-clock, so only their type is asserted.
          uptimeSeconds: expect.any(Number),
          timestamp: expect.any(String),
        },
        meta: {
          correlationId: 'contract-check-1',
          timestamp: expect.any(String),
        },
      });
    });

    it('does not leak the raw payload at the top level', async () => {
      const response = await request(server()).get(`/${GLOBAL_PREFIX}/health`).expect(200);

      // `TransformInterceptor` is the only thing standing between a controller's
      // return value and the wire, so a controller returning an unwrapped object
      // is a contract break, not a style choice.
      expect(response.body.status).toBeUndefined();
      expect(response.body.data.status).toBe('ok');
    });
  });

  describe('correlation id', () => {
    it('is present on every response, generated when the caller sends none', async () => {
      const response = await request(server()).get(`/${GLOBAL_PREFIX}/health`).expect(200);

      const correlationId = response.headers['x-correlation-id'];
      expect(correlationId).toEqual(expect.any(String));
      expect(correlationId).toMatch(/^[0-9a-f-]{36}$/);
      // The same id has to reach the body, or a log line cannot be tied to a
      // response the caller already has.
      expect(response.body.meta.correlationId).toBe(correlationId);
    });

    it('echoes a safe inbound id so a trace spans gateway, API and worker', async () => {
      const response = await request(server())
        .get(`/${GLOBAL_PREFIX}/health`)
        .set('X-Correlation-Id', 'gateway-abc.123:x')
        .expect(200);

      expect(response.headers['x-correlation-id']).toBe('gateway-abc.123:x');
      expect(response.body.meta.correlationId).toBe('gateway-abc.123:x');
    });

    it('replaces an unsafe inbound id rather than echoing it', async () => {
      // The inbound value is attacker-controlled and lands in a response header,
      // every log line and Sentry, so a value with characters outside the
      // allow-list must be discarded, not sanitised-and-partly-trusted.
      const response = await request(server())
        .get(`/${GLOBAL_PREFIX}/health`)
        .set('X-Correlation-Id', 'bad id with spaces and <script>')
        .expect(200);

      expect(response.headers['x-correlation-id']).not.toContain('script');
      expect(response.headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('is set on an error response too, so a failure is still traceable', async () => {
      const response = await request(server())
        .get(`/${GLOBAL_PREFIX}/does-not-exist`)
        .set('X-Correlation-Id', 'trace-me-404')
        .expect(404);

      expect(response.headers['x-correlation-id']).toBe('trace-me-404');
      expect(response.body.error.correlationId).toBe('trace-me-404');
    });
  });

  describe('error envelope', () => {
    it('answers an unknown route with the documented error shape', async () => {
      const response = await request(server()).get(`/${GLOBAL_PREFIX}/nope`).expect(404);

      expect(response.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: expect.any(String),
          details: [],
          correlationId: expect.any(String),
        },
      });
      // A success envelope here would mean a client parsing `data` sees
      // `undefined` instead of an error.
      expect(response.body.data).toBeUndefined();
    });

    it('does not return a stack trace or an internal class name', async () => {
      const response = await request(server()).get(`/${GLOBAL_PREFIX}/nope`).expect(404);

      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toMatch(/at .*\.ts:\d+/);
      expect(serialized).not.toContain('Error:');
    });
  });

  describe('security headers', () => {
    it('sets the helmet headers a browser client depends on', async () => {
      const response = await request(server()).get(`/${GLOBAL_PREFIX}/health`).expect(200);

      // `X-Content-Type-Options` stops a JSON response being sniffed as HTML,
      // and the frame directive is what keeps the API out of a clickjacking
      // frame when it is embedded in an admin portal.
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'");
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS', () => {
    it('allows a configured origin and reflects the credentials flag', async () => {
      const response = await request(server())
        .get(`/${GLOBAL_PREFIX}/health`)
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not allow an origin that is not on the allow-list', async () => {
      const response = await request(server())
        .get(`/${GLOBAL_PREFIX}/health`)
        .set('Origin', 'https://attacker.example')
        .expect(200);

      // The request still succeeds — CORS is a browser-enforced control, not an
      // authentication mechanism — but the browser is given no permission to
      // read the response, which is the property that matters.
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
