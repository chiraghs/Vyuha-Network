/** Domain types mirroring the FastAPI response schemas. */

export type Role = 'admin' | 'officer' | 'scrb_executive';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  role: Role;
  username: string;
}

export interface District {
  id: number;
  name: string;
  headquarter: string | null;
}

export interface Station {
  id: number;
  name: string;
  station_code: string;
  district_name: string;
}

export interface ActSection {
  act: string;
  section: string;
  description?: string | null;
}

export interface CrimeRecord {
  id: string;
  FIR_number: string; // CrimeNo (18-digit)
  case_no?: string | null;
  station_name: string;
  district_name: string;
  occurrence_time: string;
  crime_category: string; // crime sub-head
  description: string;
  latitude: number;
  longitude: number;
  status: string;
  case_category?: string | null; // FIR / UDR / PAR
  gravity?: string | null; // Heinous / Non-Heinous
  crime_head?: string | null; // major head group
  acts_sections?: ActSection[] | null;
  court_name?: string | null;
  io_officer?: string | null;
  accused_count?: number;
  victim_count?: number;
  chargesheet_type?: string | null; // A / B / C
  socio_economic_factors?: Record<string, string | null> | null;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface MapPoint {
  id: string;
  FIR_number: string;
  lat: number;
  lng: number;
  category: string;
  station: string;
}

export interface MapPointsResponse {
  points: MapPoint[];
  total: number;
  capped: boolean;
  cap: number;
}

export interface DashboardSummary {
  total: number;
  active: number;
  districts_reporting: number;
  by_status: Record<string, number>;
  by_category: Record<string, number>;
  by_head: Record<string, number>;
  by_gravity: Record<string, number>;
  by_district: Record<string, number>;
  trend: Record<string, Record<string, number>>;
}

export interface Criminal {
  id: string;
  name: string;
  alias: string | null;
  status: string;
  risk_score: number;
  crimes_count: number;
}

export interface CrimeBrief {
  id: string;
  FIR_number: string;
  crime_category: string;
  occurrence_time: string;
  station_name: string;
  district_name: string;
  status: string;
  gravity?: string | null;
  role: string | null;
}

export interface Associate {
  id: string;
  name: string;
  alias: string | null;
  relationship_type: string;
  strength: number;
  risk_score: number;
  status: string;
}

export interface OffenderStats {
  arrests: number;
  chargesheeted: number;
  heinous_cases: number;
  districts: string[];
  top_crime_heads: Array<{ head: string; count: number }>;
  acts_faced: string[];
  first_seen?: string | null;
  last_seen?: string | null;
  age?: number | null;
  gender?: string | null;
}

export interface CriminalProfile {
  id: string;
  name: string;
  alias: string | null;
  fingerprint_hash: string | null;
  status: string;
  risk_score: number;
  crimes_count: number;
  stats: OffenderStats;
  crimes: CrimeBrief[];
  associates: Associate[];
}

export interface SocioEconomicStats {
  occupation_correlation: Record<string, Record<string, number>>;
  religion_correlation: Record<string, Record<string, number>>;
}

export interface NetworkNode {
  id: string;
  label: string;
  name: string;
  alias?: string | null;
  status: string;
  risk_score: number;
  connections: number;
  is_hub: boolean;
}

export interface NetworkEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  strength: number;
}

export interface NetworkMetrics {
  total_criminals: number;
  total_relationships: number;
  max_connections: number;
  active_hubs: number;
}

export interface NetworkGraph {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  metrics: NetworkMetrics;
}

export interface ChatReply {
  original_query: string;
  translated_query: string;
  reply_text: string;
  language: string;
  timestamp: string;
  verification_hash: string;
  sentiment?: string | null;
  sentiment_score?: number | null;
  keywords?: string[] | null;
  summary?: string | null;
  detected_patterns?: string[] | null;
  recommended_actions?: string[] | null;
  confidence?: number | null;
}

/** Structured AI answer for styled rendering (chat + risk panel). */
export interface AiAnswerData {
  summary?: string | null;
  detected_patterns?: string[] | null;
  recommended_actions?: string[] | null;
  confidence?: number | null;
  sentiment?: string | null;
  keywords?: string[] | null;
}

export interface ChatHistoryEntry {
  id: string;
  query_text: string;
  reply_text: string;
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  language?: string;
  translatedQuery?: string;
  hash?: string;
  sentiment?: string | null;
  keywords?: string[] | null;
  summary?: string | null;
  detected_patterns?: string[] | null;
  recommended_actions?: string[] | null;
  confidence?: number | null;
  pending?: boolean;
  error?: boolean;
}
