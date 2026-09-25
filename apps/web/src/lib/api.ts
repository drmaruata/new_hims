import { HimsApiClient } from '@hims/api-client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export const apiClient = new HimsApiClient({
  baseUrl: API_BASE_URL,
  getAuthToken: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hims_access_token');
    }
    return null;
  },
  getFacilityId: () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hims_facility_id') || '22222222-2222-2222-2222-222222222221';
    }
    return '22222222-2222-2222-2222-222222222221';
  },
});
