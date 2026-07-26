# Karnataka Police FIR System — Official DB Schema (ER Diagram)

_Source: dataset document provided with Challenge 02 (9-page ER diagram, "Karnataka
Police Department | Confidential"). This is the canonical schema the platform should
model against. The app's current SQLAlchemy models are a simplified subset — see the
gap notes at the end._

## The CrimeNo format (important)

`CrimeNo` is an 18-digit structured identifier:

```
1 digit  Case Category Code
4 digit  District ID
4 digit  Police Station (Unit) ID
4 digit  Year
5 digit  Running serial (per station, per category, per year)
```

Examples: `FIR 1 0443 0006 2026 00001` · `UDR 3…` · `Zero FIR 8…` · `PAR 4…`
`CaseNo` = `YYYY + 5-digit serial` (the last 9 digits of `CrimeNo`).

## Core tables

### CaseMaster (the FIR / case)
`CaseMasterID` (PK), `CrimeNo`, `CaseNo`, `CrimeRegisteredDate`,
`PolicePersonID`→Employee (registering officer), `PoliceStationID`→Unit,
`CaseCategoryID`→CaseCategory, `GravityOffenceID`→GravityOffence,
`CrimeMajorHeadID`→CrimeHead, `CrimeMinorHeadID`→CrimeSubHead,
`CaseStatusID`→CaseStatusMaster, `CourtID`→Court, `IncidentFromDate`,
`IncidentToDate`, `InfoReceivedPSDate`, `latitude`, `longitude`, `BriefFacts`.

### People on a case
- **ComplainantDetails** — `ComplainantID` (PK), `CaseMasterID`, `ComplainantName`,
  `AgeYear`, `OccupationID`→OccupationMaster, `ReligionID`→ReligionMaster,
  `CasteID`→CasteMaster, `GenderID`.
- **Victim** — `VictimMasterID` (PK), `CaseMasterID`, `VictimName`, `AgeYear`,
  `GenderID`, `VictimPolice` (1/0).
- **Accused** — `AccusedMasterID` (PK), `CaseMasterID`, `AccusedName`, `AgeYear`,
  `GenderID` (M/F/T), `PersonID` (A1, A2, A3…).
- **ArrestSurrender** — `ArrestSurrenderID` (PK), `CaseMasterID`,
  `ArrestSurrenderTypeID`, `ArrestSurrenderDate`, `ArrestSurrenderStateId`→State,
  `ArrestSurrenderDistrictId`→District, `PoliceStationID`→Unit, `IOID`→Employee,
  `CourtID`→Court, `AccusedMasterID`→Accused, `IsAccused`, `IsComplainantAccused`.

### Legal framework
- **Act** — `ActCode` (PK), `ActDescription`, `ShortName`, `Active`.
- **Section** — `ActCode`→Act, `SectionCode` (e.g. 302, 307), `SectionDescription`, `Active`.
- **ActSectionAssociation** — `CaseMasterID`, `ActID`→Act.ActCode,
  `SectionID`→Section.SectionCode, `ActOrderID`, `SectionOrderID`.

### Crime classification
- **CrimeHead** — `CrimeHeadID` (PK), `CrimeGroupName` (e.g. "Crimes Against Body"), `Active`.
- **CrimeSubHead** — `CrimeSubHeadID` (PK), `CrimeHeadID`→CrimeHead,
  `CrimeHeadName` (e.g. Murder, Robbery), `SeqID`.
- **CrimeHeadActSection** — `CrimeHeadID`→CrimeHead, `ActCode`→Act, `SectionCode`.

### Chargesheet
- **ChargesheetDetails** — `CSID` (PK), `CaseMasterID`, `csdate`,
  `cstype` (A=Chargesheet, B=False Case, C=Undetected), `PolicePersonID`→Employee.

### Org / geography / lookups
- **Employee** — `EmployeeID` (PK), `DistrictID`, `UnitID`, `RankID`→Rank,
  `DesignationID`→Designation, `KGID`, `FirstName`, `EmployeeDOB`, `GenderID`,
  `BloodGroupID`, `PhysicallyChallenged`, `AppointmentDate`.
- **Unit** (police station) — `UnitID` (PK), `UnitName`, `TypeID`→UnitType,
  `ParentUnit` (self-ref hierarchy), `StateID`, `DistrictID`, `Active`.
- **UnitType** — `UnitTypeID` (PK), `UnitTypeName` (Police Station, Circle Office…),
  `CityDistState`, `Hierarchy`, `Active`.
- **District** — `DistrictID` (PK), `DistrictName`, `StateID`→State, `Active`.
- **State** — `StateID` (PK), `StateName`, `NationalityID`, `Active`.
- **Court** — `CourtID` (PK), `CourtName`, `DistrictID`→District, `StateID`→State, `Active`.
- **Rank** — `RankID` (PK), `RankName` (Constable, Inspector, DSP…), `Hierarchy`, `Active`.
- **Designation** — `DesignationID` (PK), `DesignationName` (IO, SHO…), `Active`, `SortOrder`.
- **CaseCategory** — `CaseCategoryID` (PK), `LookupValue` (FIR, UDR, PAR, Zero FIR…).
- **GravityOffence** — `GravityOffenceID` (PK), `LookupValue` (Heinous, Non-Heinous).
- **CaseStatusMaster** — `CaseStatusID` (PK), `CaseStatusName` (Under Investigation,
  Charge Sheeted, Closed…).
- **CasteMaster** / **ReligionMaster** / **OccupationMaster** — id + name lookups
  referenced by ComplainantDetails.

## Key relationships (cardinality)

One `CaseMaster` → many: Victim, Accused, ArrestSurrender, ComplainantDetails,
ActSectionAssociation; one-to-one Inv_OccuranceTime (occurrence time/location).
`CaseMaster` → many-to-one: CaseCategory, GravityOffence, CrimeHead, CrimeSubHead,
CaseStatusMaster, Court, Employee (registering officer).
`ArrestSurrender` ↔ Accused via junction `inv_arrestsurrenderaccused` (one arrest →
many accused). Act → many Sections; CrimeHead → many CrimeSubHead; Act/CrimeHead →
CrimeHeadActSection. Geography: District → State; Court/Unit/Employee → District/State.

---

## Implementation status

**This schema is now implemented** in `backend/app/db/models.py` (all tables +
the `inv_arrestsurrenderaccused` junction). Seed data (`app/scripts/seed_data.py`)
generates coherent Karnataka FIR records across every table with the real
`CrimeNo` format. The API projects the relational model onto a paginated,
SQL-aggregated contract (`app/api/analytics.py`) so large datasets never load
into memory or the browser.

Two app-only extensions were added to `Accused` (not in the source schema):
`person_key` and `alias`, used to resolve the same person across cases for the
repeat-offender and network features.

### Original mapping (how app concepts were replaced)

| App concept (now) | Official schema equivalent |
|---|---|
| `CrimeRecord.FIR_number` | `CaseMaster.CrimeNo` (18-digit structured) + `CaseNo` |
| `CrimeRecord.crime_category` (free string) | `CrimeHead` / `CrimeSubHead` + `CaseCategory` |
| `CrimeRecord.status` | `CaseStatusMaster` |
| `CrimeRecord.socio_economic_factors` (JSON, invented) | not in schema — derive from Complainant occupation/caste/religion + district stats |
| `Criminal` / `CriminalNetwork` (invented) | `Accused` + `ArrestSurrender`; networks are inferred (co-accused on shared cases) |
| `PoliceStation` | `Unit` (+ `UnitType`, hierarchy) |
| — | `GravityOffence` (Heinous), `Act`/`Section`, `Court`, `Employee`/IO, `Victim`, `Complainant`, `Chargesheet` — all new |

**Notable:** the official schema has **no socio-economic factor columns** on the case —
the app's socio-economic analytics would instead be derived from Complainant
occupation/religion/caste and district-level aggregates. Criminal "networks" are not a
stored table; they're **inferred** from accused persons sharing cases / arrest events.
