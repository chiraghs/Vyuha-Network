"""
SQLAlchemy models mirroring the official Karnataka Police FIR System ER schema
(see docs/fir-schema.md). This is the full relational model — CaseMaster with
its people (Complainant / Victim / Accused), legal framework (Act / Section),
crime classification (CrimeHead / CrimeSubHead), arrests, chargesheets, and the
org/geography lookups (Employee / Unit / Court / District / State / Rank / …).

`User` and `ChatAudit` are app-support tables (auth + assistant ledger); they
are not part of the FIR schema.
"""
import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from .database import Base


# --------------------------------------------------------------------------- #
# App-support tables (not part of the FIR schema)
# --------------------------------------------------------------------------- #
class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(30), default="officer")  # officer, admin, scrb_executive
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatAudit(Base):
    __tablename__ = "chat_audits"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    query_text = Column(Text, nullable=False)
    reply_text = Column(Text, nullable=False)
    audio_url = Column(String(255), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)


# --------------------------------------------------------------------------- #
# Geography
# --------------------------------------------------------------------------- #
class State(Base):
    __tablename__ = "states"

    StateID = Column(Integer, primary_key=True, autoincrement=True)
    StateName = Column(String(100), nullable=False, index=True)
    NationalityID = Column(Integer, default=1)
    Active = Column(Boolean, default=True)

    districts = relationship("District", back_populates="state")


class District(Base):
    __tablename__ = "districts"

    DistrictID = Column(Integer, primary_key=True, autoincrement=True)
    DistrictName = Column(String(100), nullable=False, index=True)
    StateID = Column(Integer, ForeignKey("states.StateID"), nullable=False)
    Active = Column(Boolean, default=True)
    # Convenience for map centering (not in the source schema).
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    state = relationship("State", back_populates="districts")
    units = relationship("Unit", back_populates="district")


class UnitType(Base):
    __tablename__ = "unit_types"

    UnitTypeID = Column(Integer, primary_key=True, autoincrement=True)
    UnitTypeName = Column(String(100), nullable=False)  # Police Station, Circle Office
    CityDistState = Column(String(20))  # City / District / State
    Hierarchy = Column(Integer, default=1)
    Active = Column(Boolean, default=True)


class Unit(Base):
    """Police station / unit."""

    __tablename__ = "units"

    UnitID = Column(Integer, primary_key=True, autoincrement=True)
    UnitName = Column(String(150), nullable=False, index=True)
    StationCode = Column(String(20), index=True)  # 4-digit unit id used in CrimeNo
    TypeID = Column(Integer, ForeignKey("unit_types.UnitTypeID"))
    ParentUnit = Column(Integer, ForeignKey("units.UnitID"), nullable=True)
    NationalityID = Column(Integer, default=1)
    StateID = Column(Integer, ForeignKey("states.StateID"))
    DistrictID = Column(Integer, ForeignKey("districts.DistrictID"))
    Active = Column(Boolean, default=True)

    district = relationship("District", back_populates="units")
    unit_type = relationship("UnitType")
    cases = relationship("CaseMaster", back_populates="unit")


class Court(Base):
    __tablename__ = "courts"

    CourtID = Column(Integer, primary_key=True, autoincrement=True)
    CourtName = Column(String(150), nullable=False)
    DistrictID = Column(Integer, ForeignKey("districts.DistrictID"))
    StateID = Column(Integer, ForeignKey("states.StateID"))
    Active = Column(Boolean, default=True)

    district = relationship("District")


# --------------------------------------------------------------------------- #
# Org: ranks, designations, employees
# --------------------------------------------------------------------------- #
class Rank(Base):
    __tablename__ = "ranks"

    RankID = Column(Integer, primary_key=True, autoincrement=True)
    RankName = Column(String(100), nullable=False)
    Hierarchy = Column(Integer, default=1)
    Active = Column(Boolean, default=True)


class Designation(Base):
    __tablename__ = "designations"

    DesignationID = Column(Integer, primary_key=True, autoincrement=True)
    DesignationName = Column(String(100), nullable=False)
    Active = Column(Boolean, default=True)
    SortOrder = Column(Integer, default=1)


class Employee(Base):
    __tablename__ = "employees"

    EmployeeID = Column(Integer, primary_key=True, autoincrement=True)
    DistrictID = Column(Integer, ForeignKey("districts.DistrictID"))
    UnitID = Column(Integer, ForeignKey("units.UnitID"))
    RankID = Column(Integer, ForeignKey("ranks.RankID"))
    DesignationID = Column(Integer, ForeignKey("designations.DesignationID"))
    KGID = Column(String(30), index=True)
    FirstName = Column(String(100), nullable=False)
    EmployeeDOB = Column(Date, nullable=True)
    GenderID = Column(Integer, default=1)
    BloodGroupID = Column(Integer, nullable=True)
    PhysicallyChallenged = Column(Boolean, default=False)
    AppointmentDate = Column(Date, nullable=True)

    rank = relationship("Rank")
    designation = relationship("Designation")
    unit = relationship("Unit")
    district = relationship("District")


# --------------------------------------------------------------------------- #
# Classification & legal framework
# --------------------------------------------------------------------------- #
class CaseCategory(Base):
    __tablename__ = "case_categories"

    CaseCategoryID = Column(Integer, primary_key=True, autoincrement=True)
    LookupValue = Column(String(50), nullable=False)  # FIR, UDR, PAR, Zero FIR
    CategoryCode = Column(Integer)  # 1-digit code used in CrimeNo


class GravityOffence(Base):
    __tablename__ = "gravity_offences"

    GravityOffenceID = Column(Integer, primary_key=True, autoincrement=True)
    LookupValue = Column(String(50), nullable=False)  # Heinous, Non-Heinous


class CaseStatusMaster(Base):
    __tablename__ = "case_statuses"

    CaseStatusID = Column(Integer, primary_key=True, autoincrement=True)
    CaseStatusName = Column(String(80), nullable=False)


class CrimeHead(Base):
    __tablename__ = "crime_heads"

    CrimeHeadID = Column(Integer, primary_key=True, autoincrement=True)
    CrimeGroupName = Column(String(120), nullable=False)  # Crimes Against Body
    Active = Column(Boolean, default=True)

    sub_heads = relationship("CrimeSubHead", back_populates="head")


class CrimeSubHead(Base):
    __tablename__ = "crime_sub_heads"

    CrimeSubHeadID = Column(Integer, primary_key=True, autoincrement=True)
    CrimeHeadID = Column(Integer, ForeignKey("crime_heads.CrimeHeadID"))
    CrimeHeadName = Column(String(120), nullable=False)  # Murder, Robbery
    SeqID = Column(Integer, default=1)

    head = relationship("CrimeHead", back_populates="sub_heads")


class Act(Base):
    __tablename__ = "acts"

    ActCode = Column(String(20), primary_key=True)  # e.g. IPC, NDPS
    ActDescription = Column(String(200))
    ShortName = Column(String(50))
    Active = Column(Boolean, default=True)

    sections = relationship("Section", back_populates="act")


class Section(Base):
    __tablename__ = "sections"

    SectionID = Column(Integer, primary_key=True, autoincrement=True)
    ActCode = Column(String(20), ForeignKey("acts.ActCode"))
    SectionCode = Column(String(30), index=True)  # 302, 307
    SectionDescription = Column(String(255))
    Active = Column(Boolean, default=True)

    act = relationship("Act", back_populates="sections")


class CrimeHeadActSection(Base):
    __tablename__ = "crime_head_act_sections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    CrimeHeadID = Column(Integer, ForeignKey("crime_heads.CrimeHeadID"))
    ActCode = Column(String(20), ForeignKey("acts.ActCode"))
    SectionCode = Column(String(30))


# --------------------------------------------------------------------------- #
# Reference lookups for people
# --------------------------------------------------------------------------- #
class CasteMaster(Base):
    __tablename__ = "castes"

    caste_master_id = Column(Integer, primary_key=True, autoincrement=True)
    caste_master_name = Column(String(80), nullable=False)


class ReligionMaster(Base):
    __tablename__ = "religions"

    ReligionID = Column(Integer, primary_key=True, autoincrement=True)
    ReligionName = Column(String(80), nullable=False)


class OccupationMaster(Base):
    __tablename__ = "occupations"

    OccupationID = Column(Integer, primary_key=True, autoincrement=True)
    OccupationName = Column(String(120), nullable=False)


# --------------------------------------------------------------------------- #
# The case (FIR) and everyone on it
# --------------------------------------------------------------------------- #
class CaseMaster(Base):
    __tablename__ = "case_master"

    CaseMasterID = Column(Integer, primary_key=True, autoincrement=True)
    CrimeNo = Column(String(30), unique=True, nullable=False, index=True)  # 18-digit
    CaseNo = Column(String(20), index=True)  # YYYY + 5 serial
    CrimeRegisteredDate = Column(DateTime, default=datetime.utcnow, index=True)

    PolicePersonID = Column(Integer, ForeignKey("employees.EmployeeID"))
    PoliceStationID = Column(Integer, ForeignKey("units.UnitID"))
    CaseCategoryID = Column(Integer, ForeignKey("case_categories.CaseCategoryID"))
    GravityOffenceID = Column(Integer, ForeignKey("gravity_offences.GravityOffenceID"))
    CrimeMajorHeadID = Column(Integer, ForeignKey("crime_heads.CrimeHeadID"))
    CrimeMinorHeadID = Column(Integer, ForeignKey("crime_sub_heads.CrimeSubHeadID"))
    CaseStatusID = Column(Integer, ForeignKey("case_statuses.CaseStatusID"))
    CourtID = Column(Integer, ForeignKey("courts.CourtID"), nullable=True)

    IncidentFromDate = Column(DateTime, nullable=True)
    IncidentToDate = Column(DateTime, nullable=True)
    InfoReceivedPSDate = Column(DateTime, nullable=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    BriefFacts = Column(Text)

    unit = relationship("Unit", back_populates="cases")
    officer = relationship("Employee")
    category = relationship("CaseCategory")
    gravity = relationship("GravityOffence")
    major_head = relationship("CrimeHead")
    minor_head = relationship("CrimeSubHead")
    status = relationship("CaseStatusMaster")
    court = relationship("Court")

    complainants = relationship("ComplainantDetails", back_populates="case", cascade="all, delete-orphan")
    victims = relationship("Victim", back_populates="case", cascade="all, delete-orphan")
    accused = relationship("Accused", back_populates="case", cascade="all, delete-orphan")
    arrests = relationship("ArrestSurrender", back_populates="case", cascade="all, delete-orphan")
    act_sections = relationship("ActSectionAssociation", back_populates="case", cascade="all, delete-orphan")
    chargesheets = relationship("ChargesheetDetails", back_populates="case", cascade="all, delete-orphan")


class ComplainantDetails(Base):
    __tablename__ = "complainants"

    ComplainantID = Column(Integer, primary_key=True, autoincrement=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID", ondelete="CASCADE"))
    ComplainantName = Column(String(150))
    AgeYear = Column(Integer)
    OccupationID = Column(Integer, ForeignKey("occupations.OccupationID"))
    ReligionID = Column(Integer, ForeignKey("religions.ReligionID"))
    CasteID = Column(Integer, ForeignKey("castes.caste_master_id"))
    GenderID = Column(Integer, default=1)

    case = relationship("CaseMaster", back_populates="complainants")
    occupation = relationship("OccupationMaster")
    religion = relationship("ReligionMaster")
    caste = relationship("CasteMaster")


class Victim(Base):
    __tablename__ = "victims"

    VictimMasterID = Column(Integer, primary_key=True, autoincrement=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID", ondelete="CASCADE"))
    VictimName = Column(String(150))
    AgeYear = Column(Integer)
    GenderID = Column(String(2), default="M")  # M/F/T
    VictimPolice = Column(String(2), default="0")

    case = relationship("CaseMaster", back_populates="victims")


class Accused(Base):
    __tablename__ = "accused"

    AccusedMasterID = Column(Integer, primary_key=True, autoincrement=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID", ondelete="CASCADE"))
    AccusedName = Column(String(150), index=True)
    AgeYear = Column(Integer)
    GenderID = Column(String(2), default="M")  # M/F/T
    PersonID = Column(String(10))  # A1, A2, A3…
    # Not in the source schema — a stable key + alias so the app can resolve the
    # same person appearing across multiple cases (identity resolution for the
    # repeat-offender / network features).
    person_key = Column(String(120), index=True)
    alias = Column(String(120), nullable=True)

    case = relationship("CaseMaster", back_populates="accused")
    arrest_links = relationship("InvArrestSurrenderAccused", back_populates="accused")


class ArrestSurrender(Base):
    __tablename__ = "arrest_surrender"

    ArrestSurrenderID = Column(Integer, primary_key=True, autoincrement=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID", ondelete="CASCADE"))
    ArrestSurrenderTypeID = Column(Integer, default=1)  # 1 arrest, 2 surrender
    ArrestSurrenderDate = Column(Date)
    ArrestSurrenderStateId = Column(Integer, ForeignKey("states.StateID"))
    ArrestSurrenderDistrictId = Column(Integer, ForeignKey("districts.DistrictID"))
    PoliceStationID = Column(Integer, ForeignKey("units.UnitID"))
    IOID = Column(Integer, ForeignKey("employees.EmployeeID"))
    CourtID = Column(Integer, ForeignKey("courts.CourtID"), nullable=True)
    AccusedMasterID = Column(Integer, ForeignKey("accused.AccusedMasterID"))
    IsAccused = Column(Boolean, default=True)
    IsComplainantAccused = Column(Boolean, default=False)

    case = relationship("CaseMaster", back_populates="arrests")
    io = relationship("Employee")
    accused_links = relationship("InvArrestSurrenderAccused", back_populates="arrest")


class InvArrestSurrenderAccused(Base):
    """Junction: one arrest event links to multiple accused."""

    __tablename__ = "inv_arrestsurrenderaccused"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ArrestSurrenderID = Column(Integer, ForeignKey("arrest_surrender.ArrestSurrenderID"))
    AccusedMasterID = Column(Integer, ForeignKey("accused.AccusedMasterID"))

    arrest = relationship("ArrestSurrender", back_populates="accused_links")
    accused = relationship("Accused", back_populates="arrest_links")


class ActSectionAssociation(Base):
    __tablename__ = "act_section_association"

    id = Column(Integer, primary_key=True, autoincrement=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID", ondelete="CASCADE"))
    ActID = Column(String(20), ForeignKey("acts.ActCode"))
    SectionID = Column(Integer, ForeignKey("sections.SectionID"))
    ActOrderID = Column(Integer, default=1)
    SectionOrderID = Column(Integer, default=1)

    case = relationship("CaseMaster", back_populates="act_sections")
    act = relationship("Act")
    section = relationship("Section")


class ChargesheetDetails(Base):
    __tablename__ = "chargesheets"

    CSID = Column(Integer, primary_key=True, autoincrement=True)
    CaseMasterID = Column(Integer, ForeignKey("case_master.CaseMasterID", ondelete="CASCADE"))
    csdate = Column(DateTime, nullable=True)
    cstype = Column(String(1))  # A Chargesheet, B False Case, C Undetected
    PolicePersonID = Column(Integer, ForeignKey("employees.EmployeeID"))

    case = relationship("CaseMaster", back_populates="chargesheets")
