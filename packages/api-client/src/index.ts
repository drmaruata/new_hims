import type {
  ApiResponse,
  Patient,
  Patient360Record,
  OpdAppointment,
  OpdPrescription,
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
  ClinicalVitals
} from '@hims/domain-types';

export interface ApiClientConfig {
  baseUrl: string;
  getAuthToken?: () => Promise<string | null> | string | null;
  getFacilityId?: () => string | null;
}

export class HimsApiClient {
  private baseUrl: string;
  private getAuthToken?: () => Promise<string | null> | string | null;
  private getFacilityId?: () => string | null;

  constructor(config: ApiClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.getAuthToken = config.getAuthToken;
    this.getFacilityId = config.getFacilityId;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAuthToken ? await this.getAuthToken() : null;
    const facilityId = this.getFacilityId ? this.getFacilityId() : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Correlation-Id': crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}`,
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
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody?.error?.message || `HTTP Error ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // 1. Patient & Patient 360
  public patients = {
    search: (query: string) => this.request<ApiResponse<Patient[]>>(`/patients?search=${encodeURIComponent(query)}`),
    getById: (id: string) => this.request<ApiResponse<Patient>>(`/patients/${id}`),
    get360: (id: string) => this.request<ApiResponse<Patient360Record>>(`/patients/${id}/360`),
    register: (data: any) => this.request<ApiResponse<Patient>>('/patients', { method: 'POST', body: JSON.stringify(data) }),
  };

  // 2. OPD Module
  public opd = {
    getAppointments: (params?: { date?: string; departmentId?: string }) => 
      this.request<ApiResponse<OpdAppointment[]>>(`/opd/appointments?date=${params?.date || ''}&departmentId=${params?.departmentId || ''}`),
    createAppointment: (data: any) => this.request<ApiResponse<OpdAppointment>>('/opd/appointments', { method: 'POST', body: JSON.stringify(data) }),
    checkIn: (id: string) => this.request<ApiResponse<OpdAppointment>>(`/opd/appointments/${id}/check-in`, { method: 'POST' }),
    createPrescription: (data: any) => this.request<ApiResponse<OpdPrescription>>('/opd/prescriptions', { method: 'POST', body: JSON.stringify(data) }),
  };

  // 3. IPD Module
  public ipd = {
    getBeds: (wardId?: string) => this.request<ApiResponse<Bed[]>>(`/ipd/beds?wardId=${wardId || ''}`),
    getAdmissions: () => this.request<ApiResponse<IpdAdmission[]>>('/ipd/admissions'),
    admit: (data: any) => this.request<ApiResponse<IpdAdmission>>('/ipd/admissions', { method: 'POST', body: JSON.stringify(data) }),
    recordVitals: (data: any) => this.request<ApiResponse<ClinicalVitals>>('/ipd/vitals', { method: 'POST', body: JSON.stringify(data) }),
  };

  // 4. LIS Module
  public lis = {
    getOrders: (status?: string) => this.request<ApiResponse<LabOrder[]>>(`/lab/orders?status=${status || ''}`),
    createOrder: (data: any) => this.request<ApiResponse<LabOrder>>('/lab/orders', { method: 'POST', body: JSON.stringify(data) }),
    verifyResult: (orderId: string, testCode: string, resultData: any) => 
      this.request<ApiResponse<LabOrder>>(`/lab/orders/${orderId}/tests/${testCode}/verify`, { method: 'POST', body: JSON.stringify(resultData) }),
  };

  // 5. RIS Module
  public ris = {
    getWorklist: () => this.request<ApiResponse<RadiologyOrder[]>>('/radiology/worklist'),
    createOrder: (data: any) => this.request<ApiResponse<RadiologyOrder>>('/radiology/orders', { method: 'POST', body: JSON.stringify(data) }),
    submitReport: (orderId: string, reportData: any) => 
      this.request<ApiResponse<RadiologyOrder>>(`/radiology/orders/${orderId}/report`, { method: 'POST', body: JSON.stringify(reportData) }),
  };

  // 6. Emergency Department
  public emergency = {
    getActiveCases: () => this.request<ApiResponse<EmergencyEncounter[]>>('/emergency/cases'),
    triage: (data: any) => this.request<ApiResponse<EmergencyEncounter>>('/emergency/triage', { method: 'POST', body: JSON.stringify(data) }),
  };

  // 7. OT Management
  public ot = {
    getSchedule: (date?: string) => this.request<ApiResponse<SurgeryCase[]>>(`/ot/schedule?date=${date || ''}`),
    bookCase: (data: any) => this.request<ApiResponse<SurgeryCase>>('/ot/cases', { method: 'POST', body: JSON.stringify(data) }),
  };

  // 8. ICU Module
  public icu = {
    getEpisodes: () => this.request<ApiResponse<IcuEpisode[]>>('/icu/episodes'),
  };

  // 9. Pharmacy Module
  public pharmacy = {
    getDispenseQueue: () => this.request<ApiResponse<PharmacyDispenseOrder[]>>('/pharmacy/dispense-queue'),
    dispense: (orderId: string, data: any) => this.request<ApiResponse<PharmacyDispenseOrder>>(`/pharmacy/dispense/${orderId}`, { method: 'POST', body: JSON.stringify(data) }),
  };

  // 10. Insurance & Billing
  public billing = {
    getInvoices: (patientId?: string) => this.request<ApiResponse<Invoice[]>>(`/billing/invoices?patientId=${patientId || ''}`),
    createInvoice: (data: any) => this.request<ApiResponse<Invoice>>('/billing/invoices', { method: 'POST', body: JSON.stringify(data) }),
  };

  public insurance = {
    getClaims: () => this.request<ApiResponse<InsuranceClaim[]>>('/insurance/claims'),
    submitPreAuth: (data: any) => this.request<ApiResponse<InsuranceClaim>>('/insurance/pre-auth', { method: 'POST', body: JSON.stringify(data) }),
  };

  // Quality OS
  public quality = {
    getIndicators: () => this.request<ApiResponse<QualityIndicatorMeasurement[]>>('/quality/indicators'),
    reportIncident: (data: any) => this.request<ApiResponse<IncidentReport>>('/quality/incidents', { method: 'POST', body: JSON.stringify(data) }),
  };
}
