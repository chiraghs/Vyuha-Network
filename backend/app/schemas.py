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

# District & Station Schemas
class DistrictOut(BaseModel):
    id: int
    name: str
    headquarter: Optional[str]

    class Config:
        from_attributes = True

class StationOut(BaseModel):
    id: int
    name: str
    station_code: str
    district_name: str

    class Config:
        from_attributes = True

# Crime Record Schemas
class CrimeRecordOut(BaseModel):
    id: str
    FIR_number: str
    station_name: str
    district_name: str
    occurrence_time: datetime
    crime_category: str
    description: str
    latitude: float
    longitude: float
    status: str
    socio_economic_factors: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

# Criminal Schemas
class CriminalOut(BaseModel):
    id: str
    name: str
    alias: Optional[str] = None
    status: str
    risk_score: float
    crimes_count: int

    class Config:
        from_attributes = True

# Network Graph Schemas
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
    voice_audio_base64: Optional[str] = None # Optional base64-encoded audio payload

class ChatReply(BaseModel):
    original_query: str
    translated_query: str
    reply_text: str
    language: str
    timestamp: datetime
    verification_hash: str
