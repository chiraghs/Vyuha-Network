import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Table, JSON, Text
from sqlalchemy.orm import relationship
from .database import Base

# Junction table for CrimeRecord <-> Criminal
crime_criminals = Table(
    "crime_criminals",
    Base.metadata,
    Column("crime_id", String(36), ForeignKey("crime_records.id", ondelete="CASCADE"), primary_key=True),
    Column("criminal_id", String(36), ForeignKey("criminals.id", ondelete="CASCADE"), primary_key=True),
    Column("role", String(50), default="Suspect") # e.g., Prime Suspect, Accomplice, Mastermind
)

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(30), default="officer")  # officer, admin, scrb_executive
    created_at = Column(DateTime, default=datetime.utcnow)

class District(Base):
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    headquarter = Column(String(100))

    stations = relationship("PoliceStation", back_populates="district", cascade="all, delete-orphan")

class PoliceStation(Base):
    __tablename__ = "police_stations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    station_code = Column(String(20), unique=True, nullable=False, index=True)
    district_id = Column(Integer, ForeignKey("districts.id", ondelete="CASCADE"), nullable=False)

    district = relationship("District", back_populates="stations")
    crimes = relationship("CrimeRecord", back_populates="station", cascade="all, delete-orphan")

class CrimeRecord(Base):
    __tablename__ = "crime_records"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    FIR_number = Column(String(50), unique=True, nullable=False, index=True)
    station_id = Column(Integer, ForeignKey("police_stations.id", ondelete="CASCADE"), nullable=False)
    occurrence_time = Column(DateTime, default=datetime.utcnow)
    crime_category = Column(String(100), nullable=False, index=True) # e.g., Theft, Assault, Cybercrime, Narcotics
    description = Column(Text, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(String(50), default="Under Investigation") # Open, Under Investigation, Closed, Solved
    socio_economic_factors = Column(JSON, nullable=True) # e.g., Unemployment rate, Literacy, Land dispute
    created_at = Column(DateTime, default=datetime.utcnow)

    station = relationship("PoliceStation", back_populates="crimes")
    criminals = relationship("Criminal", secondary=crime_criminals, back_populates="crimes")

class Criminal(Base):
    __tablename__ = "criminals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(100), nullable=False, index=True)
    alias = Column(String(100), nullable=True)
    fingerprint_hash = Column(String(255), unique=True, nullable=True)
    status = Column(String(50), default="Active") # Active, In Custody, Deceased, Absconding
    risk_score = Column(Float, default=0.0) # Recidivism risk score 0.0 - 100.0
    created_at = Column(DateTime, default=datetime.utcnow)

    crimes = relationship("CrimeRecord", secondary=crime_criminals, back_populates="criminals")

class CriminalNetwork(Base):
    __tablename__ = "criminal_networks"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    criminal_a = Column(String(36), ForeignKey("criminals.id", ondelete="CASCADE"), nullable=False)
    criminal_b = Column(String(36), ForeignKey("criminals.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String(100), default="Associate") # e.g., Partner, Boss, Supplier
    strength = Column(Float, default=0.5) # Strength of tie between 0.0 and 1.0
    created_at = Column(DateTime, default=datetime.utcnow)

class ChatAudit(Base):
    __tablename__ = "chat_audits"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    query_text = Column(Text, nullable=False)
    reply_text = Column(Text, nullable=False)
    audio_url = Column(String(255), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
