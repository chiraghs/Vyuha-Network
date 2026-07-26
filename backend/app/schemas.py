from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Dict, Any, Optional

# Authentication Schemas
class UserLogin(BaseModel):
    username: str = Field(..., examples=["officer"])
    password: str = Field(..., examples=["officer123"])

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    username: str

# District & Station (Unit) Schemas
class DistrictOut(BaseModel):
    id: int
    name: str
    headquarter: Optional[str] = None

class StationOut(BaseModel):
    id: int
    name: str
    station_code: str
    district_name: str

# --------------------------------------------------------------------------- #
# Case (FIR) — extends the original CrimeRecord contract with FIR fields
# --------------------------------------------------------------------------- #
class ActSectionOut(BaseModel):
    act: str
    section: str
    description: Optional[str] = None

class CrimeRecordOut(BaseModel):
    id: str
    FIR_number: str            # CrimeNo (18-digit)
    case_no: Optional[str] = None
    station_name: str
    district_name: str
    occurrence_time: datetime  # CrimeRegisteredDate
    crime_category: str        # crime sub-head (Murder, Theft…)
    description: str           # BriefFacts
    latitude: float
    longitude: float
    status: str
    # FIR schema extensions
    case_category: Optional[str] = None      # FIR / UDR / PAR / Zero FIR
    gravity: Optional[str] = None            # Heinous / Non-Heinous
    crime_head: Optional[str] = None         # major head group
    acts_sections: Optional[List[ActSectionOut]] = None
    court_name: Optional[str] = None
    io_officer: Optional[str] = None
    accused_count: int = 0
    victim_count: int = 0
    chargesheet_type: Optional[str] = None   # A / B / C
    # Retained for the map drawer — derived from complainant + gravity now.
    socio_economic_factors: Optional[Dict[str, Any]] = None

# --------------------------------------------------------------------------- #
# Offender — aggregated from Accused rows (identity-resolved by person_key)
# --------------------------------------------------------------------------- #
class CriminalOut(BaseModel):
    id: str                    # person_key
    name: str
    alias: Optional[str] = None
    status: str
    risk_score: float
    crimes_count: int

class CrimeBriefOut(BaseModel):
    id: str
    FIR_number: str
    crime_category: str
    occurrence_time: datetime
    station_name: str
    district_name: str
    status: str
    gravity: Optional[str] = None
    role: Optional[str] = None  # PersonID (A1, A2…)

class AssociateOut(BaseModel):
    id: str
    name: str
    alias: Optional[str] = None
    relationship_type: str
    strength: float
    risk_score: float
    status: str

class OffenderStats(BaseModel):
    arrests: int = 0
    chargesheeted: int = 0
    heinous_cases: int = 0
    districts: List[str] = []
    top_crime_heads: List[Dict[str, Any]] = []
    acts_faced: List[str] = []
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None
    age: Optional[int] = None
    gender: Optional[str] = None

class CriminalProfileOut(BaseModel):
    id: str
    name: str
    alias: Optional[str] = None
    fingerprint_hash: Optional[str] = None
    status: str
    risk_score: float
    crimes_count: int
    stats: OffenderStats
    crimes: List[CrimeBriefOut]
    associates: List[AssociateOut]

# Network Graph Schemas (inferred from co-accused)
class NetworkNode(BaseModel):
    id: str
    label: str
    name: str
    alias: Optional[str] = None
    status: str
    risk_score: float
    connections: int
    is_hub: bool

class NetworkEdge(BaseModel):
    id: str
    source: str
    target: str
    relation: str
    strength: float

class NetworkGraph(BaseModel):
    nodes: List[NetworkNode]
    edges: List[NetworkEdge]
    metrics: Dict[str, Any]

# Conversational AI Schemas
class ChatQuery(BaseModel):
    query_text: str
    voice_audio_base64: Optional[str] = None

class ChatReply(BaseModel):
    original_query: str
    translated_query: str
    reply_text: str
    language: str
    timestamp: datetime
    verification_hash: str
    sentiment: Optional[str] = None
    sentiment_score: Optional[float] = None
    keywords: Optional[List[str]] = None
