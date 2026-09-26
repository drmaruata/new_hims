import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, HimsApiClient } from './index';

/**
 * Every identifier below is synthetic. `patients.findByIdentifier` exists to
 * carry a plaintext identifier to the API for HMACing, so these tests must
 * never use anything resembling a real patient record.
 */

const fetchMock = vi.fn();

interface StubResponse {
  ok?: boolean;
  status?: number;
  statusText?: string;
  /** Serialised as JSON on a successful read. */
  body?: unknown;
  /** Makes `response.json()` reject, as a proxy 502 or an HTML error page would. */
  bodyIsNotJson?: boolean;
}

function stubResponse(stub: StubResponse): unknown {
  return {
    ok: stub.ok ?? true,
    status: stub.status ?? 200,
    statusText: stub.statusText ?? 'OK',
    json: async () => {
      if (stub.bodyIsNotJson) throw new SyntaxError('Unexpected token < in JSON at position 0');
      return stub.body;
    },
  };
}

/** The URL and headers the client actually put on the wire for request `index`. */
function sentRequest(index = 0): { url: string; headers: Record<string, string> } {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, headers: init.headers as Record<string, string> };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiError', () => {
  it('carries the machine-readable contract fields rather than only a message', () => {
    const error = new ApiError(
      409,
      {
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: 'Cannot sign an encounter in state OPEN',
          details: [{ field: 'state', message: 'Allowed from OPEN: start' }],
          correlationId: 'corr-1',
        },
      },
      'Conflict'
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ApiError');
    expect(error.status).toBe(409);
    expect(error.code).toBe('INVALID_STATE_TRANSITION');
    expect(error.message).toBe('Cannot sign an encounter in state OPEN');
    expect(error.details).toEqual([{ field: 'state', message: 'Allowed from OPEN: start' }]);
    expect(error.correlationId).toBe('corr-1');
  });

  it('classifies 401 and 403 as auth errors so a caller can route to sign-in', () => {
    expect(new ApiError(401, null, 'Unauthorized').isAuthError).toBe(true);
    expect(new ApiError(403, null, 'Forbidden').isAuthError).toBe(true);
    expect(new ApiError(500, null, 'Server Error').isAuthError).toBe(false);
  });

  it('classifies 409 as the contract state-or-concurrency conflict', () => {
    expect(new ApiError(409, null, 'Conflict').isConflict).toBe(true);
    expect(new ApiError(400, null, 'Bad Request').isConflict).toBe(false);
  });

  it('degrades safely when there is no error body at all', () => {
    const noBody = new ApiError(502, null, 'Bad Gateway');
    expect(noBody.code).toBe('UNKNOWN');
    expect(noBody.message).toBe('HTTP 502 Bad Gateway');
    expect(noBody.details).toEqual([]);
    expect(noBody.correlationId).toBeUndefined();
  });
});

describe('HimsApiClient', () => {
  it('unwraps the { data, meta } envelope on success', async () => {
    fetchMock.mockResolvedValue(stubResponse({ body: { data: { id: 'patient-1' }, meta: {} } }));

    const client = new HimsApiClient({ baseUrl: 'http://localhost:3001/api/v1' });
    await expect(client.patients.getById('patient-1')).resolves.toEqual({
      data: { id: 'patient-1' },
      meta: {},
    });
  });

  it('does not double the slash when the configured base URL has a trailing one', async () => {
    fetchMock.mockResolvedValue(stubResponse({ body: { data: [], meta: {} } }));

    const client = new HimsApiClient({ baseUrl: 'http://localhost:3001/api/v1/' });
    await client.commandCenter.getMetrics();

    expect(sentRequest().url).toBe('http://localhost:3001/api/v1/command-center/metrics');
  });

  it('sends no Authorization header when there is no session', async () => {
    fetchMock.mockResolvedValue(stubResponse({ body: { data: [], meta: {} } }));

    const client = new HimsApiClient({ baseUrl: 'http://localhost:3001/api/v1' });
    await client.commandCenter.getMetrics();

    expect(sentRequest().headers).not.toHaveProperty('Authorization');
  });

  it('reads the token and facility scope per request, so a refresh or a switch takes effect', async () => {
    fetchMock.mockResolvedValue(stubResponse({ body: { data: [], meta: {} } }));

    let token = 'token-1';
    let facilityId: string | null = null;
    const client = new HimsApiClient({
      baseUrl: 'http://localhost:3001/api/v1',
      getAuthToken: () => token,
      getFacilityId: () => facilityId,
    });

    await client.commandCenter.getMetrics();
    expect(sentRequest(0).headers['Authorization']).toBe('Bearer token-1');
    expect(sentRequest(0).headers).not.toHaveProperty('X-Facility-Id');

    token = 'token-2';
    facilityId = 'facility-1';
    await client.commandCenter.getMetrics();
    expect(sentRequest(1).headers['Authorization']).toBe('Bearer token-2');
    expect(sentRequest(1).headers['X-Facility-Id']).toBe('facility-1');
  });

  it('stamps a distinct correlation id on every request', async () => {
    fetchMock.mockResolvedValue(stubResponse({ body: { data: [], meta: {} } }));

    const client = new HimsApiClient({ baseUrl: 'http://localhost:3001/api/v1' });
    await client.commandCenter.getMetrics();
    await client.commandCenter.getMetrics();

    const first = sentRequest(0).headers['X-Correlation-Id'];
    const second = sentRequest(1).headers['X-Correlation-Id'];
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(second).not.toBe(first);
  });

  it('raises a faithful ApiError from a contract error body', async () => {
    fetchMock.mockResolvedValue(
      stubResponse({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        body: {
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Not permitted',
            correlationId: 'corr-2',
          },
        },
      })
    );

    const client = new HimsApiClient({ baseUrl: 'http://localhost:3001/api/v1' });
    const error = await client.commandCenter.getMetrics().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 403,
      code: 'PERMISSION_DENIED',
      message: 'Not permitted',
      correlationId: 'corr-2',
    });
  });

  it('still raises a usable ApiError when the failure body is not JSON', async () => {
    fetchMock.mockResolvedValue(
      stubResponse({ ok: false, status: 502, statusText: 'Bad Gateway', bodyIsNotJson: true })
    );

    const client = new HimsApiClient({ baseUrl: 'http://localhost:3001/api/v1' });
    const error = await client.commandCenter.getMetrics().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502, code: 'UNKNOWN', message: 'HTTP 502 Bad Gateway' });
  });

  it('narrows a body that does not match the contract instead of trusting it', async () => {
    // A proxy or a misconfigured gateway can return 200-shaped JSON under an
    // error status, so the parsed body is treated as untrusted, not typed.
    fetchMock.mockResolvedValue(
      stubResponse({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        body: { error: { code: 7, message: null, details: 'not-an-array' } },
      })
    );

    const client = new HimsApiClient({ baseUrl: 'http://localhost:3001/api/v1' });
    const error = await client.commandCenter.getMetrics().catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'UNKNOWN', message: 'Request failed' });
    expect((error as ApiError).details).toEqual([]);
  });

  it('percent-encodes a patient search term so it cannot break out of the query', async () => {
    fetchMock.mockResolvedValue(stubResponse({ body: { data: [], meta: {} } }));

    const client = new HimsApiClient({ baseUrl: 'http://localhost:3001/api/v1' });
    await client.patients.search('a&b=c');

    expect(sentRequest().url).toBe('http://localhost:3001/api/v1/patients?search=a%26b%3Dc');
  });

  it('sends the opaque identifier type and value as separate encoded path segments', async () => {
    fetchMock.mockResolvedValue(stubResponse({ body: { data: { id: 'patient-1' }, meta: {} } }));

    const client = new HimsApiClient({ baseUrl: 'http://localhost:3001/api/v1' });
    await client.patients.findByIdentifier('AADHAAR', '0000 0000 0000');

    expect(sentRequest().url).toBe(
      'http://localhost:3001/api/v1/patients/identifier/AADHAAR/0000%200000%200000'
    );
  });

  it('omits the query string entirely when no OPD filter is supplied', async () => {
    fetchMock.mockResolvedValue(stubResponse({ body: { data: [], meta: {} } }));

    const client = new HimsApiClient({ baseUrl: 'http://localhost:3001/api/v1' });
    await client.opd.getAppointments();
    expect(sentRequest(0).url).toBe('http://localhost:3001/api/v1/opd/appointments');

    await client.opd.getAppointments({ date: '2026-01-15', status: 'CONFIRMED' });
    expect(sentRequest(1).url).toBe(
      'http://localhost:3001/api/v1/opd/appointments?date=2026-01-15&status=CONFIRMED'
    );
  });

  it('sends a write as JSON with the contract method', async () => {
    fetchMock.mockResolvedValue(stubResponse({ body: { data: { id: 'encounter-1' }, meta: {} } }));

    const client = new HimsApiClient({ baseUrl: 'http://localhost:3001/api/v1' });
    await client.emergency.triage({ encounterType: 'TRAUMA' });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ encounterType: 'TRAUMA' });
  });
});
