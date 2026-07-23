export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'officer' | 'scrb_executive';
}

export interface District {
  id: number;
  name: string;
  headquarter: string;
}

export interface Station {
  id: number;
  name: string;
  station_code: string;
  district_name: string;
}

export interface CrimeRecord {
  id: string;
  FIR_number: string;
  station_name: string;
  district_name: string;
  occurrence_time: string;
  crime_category: string;
  description: string;
  latitude: number;
  longitude: number;
  status: string;
  socio_economic_factors?: {
    unemployment_rate?: number;
    literacy_rate?: number;
    poverty_index?: string;
    alcohol_consumption?: string;
  };
}

export interface CriminalNode {
  id: string;
  label: string;
  name: string;
  alias?: string;
  status: string;
  risk_score: number;
  connections: number;
  is_hub: boolean;
}

export interface CriminalEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  strength: number;
}

export interface NetworkGraph {
  nodes: CriminalNode[];
  edges: CriminalEdge[];
  metrics: {
    total_criminals: number;
    total_relationships: number;
    max_connections: number;
    active_hubs: number;
  };
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  translated?: string;
  hash?: string;
  isAudio?: boolean;
}
