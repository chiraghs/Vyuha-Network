import { api } from './client';
import type {
  ChatHistoryEntry,
  ChatReply,
  CrimeRecord,
  Criminal,
  CriminalProfile,
  DashboardSummary,
  District,
  LoginResponse,
  MapPointsResponse,
  NetworkGraph,
  Paginated,
  SocioEconomicStats,
  Station,
  User,
} from '../types';

export const AuthAPI = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }).then((r) => r.data),
  me: () => api.get<User>('/auth/me').then((r) => r.data),
};

export interface CrimeFilters {
  district_id?: number;
  station_id?: number;
  category?: string;
  search?: string;
}

export const AnalyticsAPI = {
  districts: () => api.get<District[]>('/analytics/districts').then((r) => r.data),
  stations: (districtId?: number) =>
    api
      .get<Station[]>('/analytics/stations', { params: { district_id: districtId } })
      .then((r) => r.data),
  summary: (districtId?: number) =>
    api
      .get<DashboardSummary>('/analytics/summary', { params: { district_id: districtId } })
      .then((r) => r.data),
  crimes: (filters: CrimeFilters = {}, page = 1, pageSize = 50) =>
    api
      .get<Paginated<CrimeRecord>>('/analytics/crimes', {
        params: { ...filters, page, page_size: pageSize },
      })
      .then((r) => r.data),
  mapPoints: (filters: CrimeFilters = {}, limit = 2000) =>
    api
      .get<MapPointsResponse>('/analytics/map-points', { params: { ...filters, limit } })
      .then((r) => r.data),
  case: (id: string) => api.get<CrimeRecord>(`/analytics/cases/${id}`).then((r) => r.data),
  offenderStats: () =>
    api
      .get<{ total: number; repeat: number; prolific: number; max_cases: number; avg_cases: number }>(
        '/analytics/offender-stats',
      )
      .then((r) => r.data),
  criminals: (search?: string, page = 1, pageSize = 25) =>
    api
      .get<Paginated<Criminal>>('/analytics/criminals', {
        params: { search, page, page_size: pageSize },
      })
      .then((r) => r.data),
  criminalProfile: (id: string) =>
    api.get<CriminalProfile>(`/analytics/criminals/${encodeURIComponent(id)}`).then((r) => r.data),
  socioEconomic: () =>
    api.get<SocioEconomicStats>('/analytics/socio-economic').then((r) => r.data),
};

export const NetworkAPI = {
  graph: () => api.get<NetworkGraph>('/network').then((r) => r.data),
};

export interface FaceMatch {
  id: string;
  name: string;
  alias: string | null;
  status: string;
  risk_score: number;
  confidence: number;
  matched: boolean;
}

export const IntelAPI = {
  status: () =>
    api.get<{ catalyst_ai_enabled: boolean }>('/intel/status').then((r) => r.data),
  ocr: (file: File, language = 'eng') => {
    const form = new FormData();
    form.append('file', file);
    form.append('language', language);
    return api
      .post<{ available: boolean; text?: string; confidence?: number; message?: string }>(
        '/intel/ocr',
        form,
      )
      .then((r) => r.data);
  },
  faceSearch: (file: File, limit = 5) => {
    const form = new FormData();
    form.append('file', file);
    form.append('limit', String(limit));
    return api
      .post<{ available: boolean; enrolled_photos?: number; matches: FaceMatch[] }>(
        '/intel/face-search',
        form,
      )
      .then((r) => r.data);
  },
};

export interface AdminConfigKey {
  key: string;
  value: string | null;
  set: boolean;
  secret: boolean;
  needs_restart: boolean;
}

export interface AdminMetrics {
  uptime_s: number;
  request_count: number;
  by_status: Record<string, number>;
  top_routes: Array<[string, number]>;
  recent: Array<{ t: number; method: string; route: string; status: number; ms: number }>;
  ai: {
    calls: number;
    real: number;
    fallback: number;
    provider: string | null;
    model: string | null;
    last_error: string | null;
    last_latency_ms: number | null;
  };
  ocr: { calls: number; success: number; fallback: number };
  ai_configured: boolean;
  ocr_configured: boolean;
}

export interface AdminLogLine {
  t: number;
  level: string;
  line: string;
}

export const AdminAPI = {
  config: () =>
    api
      .get<{ known: AdminConfigKey[]; others: Record<string, string | null> }>('/admin/config')
      .then((r) => r.data),
  setConfig: (key: string, value: string) =>
    api.put('/admin/config', { key, value }).then((r) => r.data),
  deleteConfig: (key: string) =>
    api.delete(`/admin/config/${encodeURIComponent(key)}`).then((r) => r.data),
  logs: (limit = 200) =>
    api.get<{ logs: AdminLogLine[] }>('/admin/logs', { params: { limit } }).then((r) => r.data),
  metrics: () => api.get<AdminMetrics>('/admin/metrics').then((r) => r.data),
};

export const ChatAPI = {
  send: (queryText: string) =>
    api.post<ChatReply>('/chat', { query_text: queryText }).then((r) => r.data),
  history: () => api.get<ChatHistoryEntry[]>('/chat/history').then((r) => r.data),
  exportPdf: () =>
    api.get<Blob>('/chat/export-pdf', { responseType: 'blob' }).then((r) => r.data),
};
