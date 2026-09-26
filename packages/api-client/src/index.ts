import type {
  ApiResponse,
  Patient,
  Patient360Record,
  CommandCenterMetrics,
  OpdAppointment,
  IpdAdmission,
  Bed,
  LabOrder,
  RadiologyOrder,
  EmergencyEncounter,
  SurgeryCase,
  IcuEpisode,
  PharmacyDispenseOrder,
  Invoice,
  InsuranceClaim,
  QualityIndicatorMeasurement,
  IncidentReport,
  ClinicalVitals,
  PatientIdentifier,
} from '@hims/domain-types';

/**
 * The error body every failing endpoint returns (API_CONTRACT §5/§6).
 *
 * The client models it rather than reading `any`, so a caller can branch on
 * `code` instead of matching on an English message string.
 */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
    correlationId?: string;
  };
}

/**
 * A non-2xx response from the API.
 *
 * Carries the HTTP status and the machine-readable `code` so callers can
 * distinguish, say, a 409 state conflict from a 403, without string matching.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Array<{ field: string; message: string }>;
  readonly correlationId: string | undefined;

  constructor(status: number, body: Partial<ApiErrorBody> | null, fallbackText: string) {
    const message = body?.error?.message ?? `HTTP ${status} ${fallbackText}`.trim();
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body?.error?.code ?? 'UNKNOWN';
    this.details = body?.error?.details ?? [];
    this.correlationId = body?.error?.correlationId;
  }

  /** True for 401/403, so a caller can route to sign-in rather than show an error. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  /** True for 409, the contract's state-or-concurrency conflict. */
  get isConflict(): boolean {
    return this.status === 409;
  }
}

/** Narrow an unknown parsed JSON body to the error shape, without trusting it. */
function asErrorBody(value: unknown): Partial<ApiErrorBody> | null {
  if (typeof value !== 'object' || value === null || !('error' in value)) return null;
  const error = (value as { error: unknown }).error;
  if (typeof error !== 'object' || error === null) return null;
  const { code, message, details, correlationId } = error as Record<string, unknown>;
  return {
    error: {
      code: typeof code === 'string' ? code : 'UNKNOWN',
      message: typeof message === 'string' ? message : 'Request failed',
      details: Array.isArray(details) ? (details as ApiErrorBody['error']['details']) : undefined,
      correlationId: typeof correlationId === 'string' ? correlationId : undefined,
    },
  };
}

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => Promise<string | null> | string | null;
  getFacilityId?: () => string | null;
}

/**
 * A JSON request body.
 *
 * Deliberately an open object rather than a hand-written interface per
 * endpoint. The authoritative wire types are in `doc/openapi.yaml` and are
 * meant to be generated from it (`openapi-typescript` is in the workspace
 * catalog); a second, hand-copied set here would drift from the contract on
 * the first change and the drift would be invisible, because this client
 * asserts response shapes rather than validating them. Callers pass the
 * request body the API contract defines until that generation lands.
 */
export type JsonRequestBody = Record<string, unknown>;

export class HimsApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null> | string | null;
  private getFacilityId?: () => string | null;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.getAuthToken = config.getAuthToken;
    this.getFacilityId = config.getFacilityId;
  }

  /**
   * Issue a request and unwrap the `{ data, meta }` envelope.
   *
   * `T` is the *enveloped* type the caller asked for. The response is not
   * schema-validated here — the endpoint list below is still a work in
   * progress, and a hand-written schema per call would be a second, divergent
   * source of truth until the OpenAPI types are generated. Until then this is
   * an unchecked assertion, so callers must not treat it as proof of shape;
   * `ApiError` at least reports failures faithfully.
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAuthToken ? await this.getAuthToken() : null;
    const facilityId = this.getFacilityId ? this.getFacilityId() : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // Ties the browser's failure to the server's log line. The server bounds
      // and sanitises whatever arrives on this header before echoing it.
      'X-Correlation-Id': crypto.randomUUID(),
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (facilityId) {
      headers['X-Facility-Id'] = facilityId;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // The body may be absent or not JSON (a proxy 502, for example), so both
      // the parse and the read are guarded before an error is constructed.
      const body = await response
        .json()
        .then(asErrorBody)
        .catch(() => null);
      throw new ApiError(response.status, body, response.statusText);
    }

    return (await response.json()) as T;
  }

  // 1. Patient & Patient 360
  public patients = {
    search: (query: string) =>
      this.request<ApiResponse<Patient[]>>(`/patients?search=${encodeURIComponent(query)}`),
    getById: (id: string) => this.request<ApiResponse<Patient>>(`/patients/${id}`),
    get360: (id: string) => this.request<ApiResponse<Patient360Record>>(`/patients/${id}/360`),
    register: (data: JsonRequestBody) =>
      this.request<ApiResponse<Patient>>('/patients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    /**
     * The plaintext identifier is sent in the path so the server can HMAC it
     * against `patient_identifiers.value_hash`. That is a deliberate trade:
     * the value must reach the server to be hashed, and a POST body would put
     * it in every access log and proxy trace instead. The server never stores
     * or returns it.
     */
    findByIdentifier: (type: string, value: string) =>
      this.request<ApiResponse<Patient>>(
        `/patients/identifier/${encodeURIComponent(type)}/${encodeURIComponent(value)}`
      ),
    listIdentifiers: (id: string) =>
      this.request<ApiResponse<PatientIdentifier[]>>(`/patients/${id}/identifiers`),
  };

  // Command centre
  public commandCenter = {
    getMetrics: () => this.request<ApiResponse<CommandCenterMetrics>>('/command-center/metrics'),
  };

  // 2. OPD Module
  public opd = {
    /**
     * The OPD register for a business date. `date` is a `YYYY-MM-DD` business
     * date in the facility's timezone; omitting it lets the API resolve today
     * there rather than in the server's zone.
     */
    getAppointments: (params?: { date?: string; departmentId?: string; status?: string }) => {
      const query = new URLSearchParams();
      if (params?.date) query.set('date', params.date);
      if (params?.departmentId) query.set('departmentId', params.departmentId);
      if (params?.status) query.set('status', params.status);
      const suffix = query.toString();
      return this.request<ApiResponse<OpdAppointment[]>>(
        `/opd/appointments${suffix ? `?${suffix}` : ''}`
      );
    },
    checkIn: (id: string, date: string) =>
      this.request<ApiResponse<OpdAppointment>>(`/opd/appointments/${id}/check-in`, {
        method: 'POST',
        body: JSON.stringify({ date }),
      }),
  };

  // 3. IPD Module
  public ipd = {
    getBeds: (wardId?: string) =>
      this.request<ApiResponse<Bed[]>>(`/ipd/beds?wardId=${wardId || ''}`),
    getAdmissions: () => this.request<ApiResponse<IpdAdmission[]>>('/ipd/admissions'),
    admit: (data: JsonRequestBody) =>
      this.request<ApiResponse<IpdAdmission>>('/ipd/admissions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    recordVitals: (data: JsonRequestBody) =>
      this.request<ApiResponse<ClinicalVitals>>('/ipd/vitals', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // 4. LIS Module
  public lis = {
    getOrders: (status?: string) =>
      this.request<ApiResponse<LabOrder[]>>(`/lab/orders?status=${status || ''}`),
    createOrder: (data: JsonRequestBody) =>
      this.request<ApiResponse<LabOrder>>('/lab/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    verifyResult: (orderId: string, testCode: string, resultData: JsonRequestBody) =>
      this.request<ApiResponse<LabOrder>>(`/lab/orders/${orderId}/tests/${testCode}/verify`, {
        method: 'POST',
        body: JSON.stringify(resultData),
      }),
  };

  // 5. RIS Module
  public ris = {
    getWorklist: () => this.request<ApiResponse<RadiologyOrder[]>>('/radiology/worklist'),
    createOrder: (data: JsonRequestBody) =>
      this.request<ApiResponse<RadiologyOrder>>('/radiology/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    submitReport: (orderId: string, reportData: JsonRequestBody) =>
      this.request<ApiResponse<RadiologyOrder>>(`/radiology/orders/${orderId}/report`, {
        method: 'POST',
        body: JSON.stringify(reportData),
      }),
  };

  // 6. Emergency Department
  public emergency = {
    getActiveCases: () => this.request<ApiResponse<EmergencyEncounter[]>>('/emergency/cases'),
    triage: (data: JsonRequestBody) =>
      this.request<ApiResponse<EmergencyEncounter>>('/emergency/triage', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // 7. OT Management
  public ot = {
    getSchedule: (date?: string) =>
      this.request<ApiResponse<SurgeryCase[]>>(`/ot/schedule?date=${date || ''}`),
    bookCase: (data: JsonRequestBody) =>
      this.request<ApiResponse<SurgeryCase>>('/ot/cases', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // 8. ICU Module
  public icu = {
    getEpisodes: () => this.request<ApiResponse<IcuEpisode[]>>('/icu/episodes'),
  };

  // 9. Pharmacy Module
  public pharmacy = {
    getDispenseQueue: () =>
      this.request<ApiResponse<PharmacyDispenseOrder[]>>('/pharmacy/dispense-queue'),
    dispense: (orderId: string, data: JsonRequestBody) =>
      this.request<ApiResponse<PharmacyDispenseOrder>>(`/pharmacy/dispense/${orderId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // 10. Insurance & Billing
  public billing = {
    getInvoices: (patientId?: string) =>
      this.request<ApiResponse<Invoice[]>>(`/billing/invoices?patientId=${patientId || ''}`),
    createInvoice: (data: JsonRequestBody) =>
      this.request<ApiResponse<Invoice>>('/billing/invoices', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  public insurance = {
    getClaims: () => this.request<ApiResponse<InsuranceClaim[]>>('/insurance/claims'),
    submitPreAuth: (data: JsonRequestBody) =>
      this.request<ApiResponse<InsuranceClaim>>('/insurance/pre-auth', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };

  // Quality OS
  public quality = {
    getIndicators: () =>
      this.request<ApiResponse<QualityIndicatorMeasurement[]>>('/quality/indicators'),
    reportIncident: (data: JsonRequestBody) =>
      this.request<ApiResponse<IncidentReport>>('/quality/incidents', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  };
}
