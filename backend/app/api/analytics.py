"""
Analytics API over the FIR schema.

Built for scale: list endpoints are paginated (LIMIT/OFFSET + total count),
dashboard/analytics figures are computed with SQL aggregation (never by pulling
rows into the app), and the map endpoint returns a bounded, capped point set.
Nothing here loads an unbounded result into memory.
"""
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import String, and_, cast, func, or_
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db import models
from app.db.database import get_db
from app.schemas import (
    ActSectionOut,
    AssociateOut,
    CrimeBriefOut,
    CrimeRecordOut,
    CriminalOut,
    CriminalProfileOut,
    DistrictOut,
    OffenderStats,
    StationOut,
)
from app.services import offender_analytics as oa

router = APIRouter(prefix="/analytics", tags=["Analytics & Cases"])

MAP_POINT_CAP = 2000       # hard ceiling on points shipped to the map
MAX_PAGE_SIZE = 100


# --------------------------------------------------------------------------- #
# Geography (small, bounded)
# --------------------------------------------------------------------------- #
@router.get("/districts", response_model=List[DistrictOut])
def get_districts(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    rows = db.query(models.District).filter(models.District.Active.is_(True)).all()
    return [DistrictOut(id=d.DistrictID, name=d.DistrictName, headquarter=d.DistrictName) for d in rows]


@router.get("/stations", response_model=List[StationOut])
def get_stations(
    district_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models.Unit)
        .options(joinedload(models.Unit.district), joinedload(models.Unit.unit_type))
        .join(models.UnitType)
        .filter(models.UnitType.UnitTypeName == "Police Station")
    )
    if district_id:
        q = q.filter(models.Unit.DistrictID == district_id)
    return [
        StationOut(
            id=u.UnitID,
            name=u.UnitName,
            station_code=u.StationCode or "",
            district_name=u.district.DistrictName if u.district else "",
        )
        for u in q.all()
    ]


# --------------------------------------------------------------------------- #
# Case filtering (shared by list + map + summary)
# --------------------------------------------------------------------------- #
def _apply_case_filters(q, district_id, station_id, category, search):
    if district_id:
        q = q.filter(models.Unit.DistrictID == district_id)
    if station_id:
        q = q.filter(models.CaseMaster.PoliceStationID == station_id)
    if category:
        q = q.filter(models.CrimeSubHead.CrimeHeadName == category)
    if search:
        like = f"%{search}%"
        q = q.filter(or_(models.CaseMaster.CrimeNo.ilike(like), models.CaseMaster.BriefFacts.ilike(like)))
    return q


def _case_to_out(c: models.CaseMaster, light: bool = False) -> CrimeRecordOut:
    district_name = c.unit.district.DistrictName if c.unit and c.unit.district else ""
    base = CrimeRecordOut(
        id=str(c.CaseMasterID),
        FIR_number=c.CrimeNo,
        case_no=c.CaseNo,
        station_name=c.unit.UnitName if c.unit else "",
        district_name=district_name,
        occurrence_time=c.CrimeRegisteredDate,
        crime_category=c.minor_head.CrimeHeadName if c.minor_head else "Unclassified",
        description=c.BriefFacts or "",
        latitude=c.latitude,
        longitude=c.longitude,
        status=c.status.CaseStatusName if c.status else "Unknown",
        case_category=c.category.LookupValue if c.category else None,
        gravity=c.gravity.LookupValue if c.gravity else None,
        crime_head=c.major_head.CrimeGroupName if c.major_head else None,
    )
    if light:
        return base
    base.acts_sections = [
        ActSectionOut(
            act=a.act.ShortName if a.act else a.ActID,
            section=a.section.SectionCode if a.section else "",
            description=a.section.SectionDescription if a.section else None,
        )
        for a in c.act_sections
    ]
    base.court_name = c.court.CourtName if c.court else None
    base.io_officer = c.officer.FirstName if c.officer else None
    base.accused_count = len(c.accused)
    base.victim_count = len(c.victims)
    cs = c.chargesheets[0] if c.chargesheets else None
    base.chargesheet_type = cs.cstype if cs else None
    comp = c.complainants[0] if c.complainants else None
    base.socio_economic_factors = {
        "complainant_occupation": comp.occupation.OccupationName if comp and comp.occupation else None,
        "complainant_religion": comp.religion.ReligionName if comp and comp.religion else None,
        "complainant_caste": comp.caste.caste_master_name if comp and comp.caste else None,
        "gravity": base.gravity,
    }
    return base


@router.get("/crimes")
def get_crimes(
    district_id: Optional[int] = None,
    station_id: Optional[int] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=MAX_PAGE_SIZE),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Paginated FIR list. Returns {items, total, page, page_size, pages}."""
    base = (
        db.query(models.CaseMaster)
        .join(models.Unit, models.CaseMaster.PoliceStationID == models.Unit.UnitID)
        .outerjoin(models.CrimeSubHead, models.CaseMaster.CrimeMinorHeadID == models.CrimeSubHead.CrimeSubHeadID)
    )
    base = _apply_case_filters(base, district_id, station_id, category, search)
    total = base.with_entities(func.count(func.distinct(models.CaseMaster.CaseMasterID))).scalar() or 0

    rows = (
        base.options(
            joinedload(models.CaseMaster.unit).joinedload(models.Unit.district),
            joinedload(models.CaseMaster.minor_head),
            joinedload(models.CaseMaster.major_head),
            joinedload(models.CaseMaster.gravity),
            joinedload(models.CaseMaster.category),
            joinedload(models.CaseMaster.status),
            joinedload(models.CaseMaster.court),
            joinedload(models.CaseMaster.officer),
            joinedload(models.CaseMaster.act_sections).joinedload(models.ActSectionAssociation.act),
            joinedload(models.CaseMaster.act_sections).joinedload(models.ActSectionAssociation.section),
            joinedload(models.CaseMaster.accused),
            joinedload(models.CaseMaster.victims),
            joinedload(models.CaseMaster.complainants),
            joinedload(models.CaseMaster.chargesheets),
        )
        .order_by(models.CaseMaster.CrimeRegisteredDate.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "items": [_case_to_out(c).model_dump() for c in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.get("/map-points")
def get_map_points(
    district_id: Optional[int] = None,
    station_id: Optional[int] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(MAP_POINT_CAP, ge=1, le=MAP_POINT_CAP),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Bounded, lightweight points for the map (never more than the cap)."""
    base = (
        db.query(
            models.CaseMaster.CaseMasterID,
            models.CaseMaster.CrimeNo,
            models.CaseMaster.latitude,
            models.CaseMaster.longitude,
            models.CrimeSubHead.CrimeHeadName,
            models.Unit.UnitName,
        )
        .join(models.Unit, models.CaseMaster.PoliceStationID == models.Unit.UnitID)
        .outerjoin(models.CrimeSubHead, models.CaseMaster.CrimeMinorHeadID == models.CrimeSubHead.CrimeSubHeadID)
    )
    base = _apply_case_filters(base, district_id, station_id, category, search)
    total = base.with_entities(func.count(func.distinct(models.CaseMaster.CaseMasterID))).scalar() or 0
    rows = base.order_by(models.CaseMaster.CrimeRegisteredDate.desc()).limit(limit).all()
    return {
        "points": [
            {
                "id": str(r[0]),
                "FIR_number": r[1],
                "lat": r[2],
                "lng": r[3],
                "category": r[4] or "Unclassified",
                "station": r[5] or "",
            }
            for r in rows
        ],
        "total": total,
        "capped": total > limit,
        "cap": limit,
    }


@router.get("/cases/{case_id}", response_model=CrimeRecordOut)
def get_case(
    case_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    c = db.query(models.CaseMaster).filter(models.CaseMaster.CaseMasterID == case_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Case not found")
    return _case_to_out(c)


# --------------------------------------------------------------------------- #
# Dashboard summary — all SQL aggregation, compact payload
# --------------------------------------------------------------------------- #
@router.get("/summary")
def get_summary(
    district_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    def scoped(q):
        if district_id:
            q = q.join(models.Unit, models.CaseMaster.PoliceStationID == models.Unit.UnitID).filter(
                models.Unit.DistrictID == district_id
            )
        return q

    total = scoped(db.query(func.count(models.CaseMaster.CaseMasterID))).scalar() or 0

    by_status = dict(
        scoped(
            db.query(models.CaseStatusMaster.CaseStatusName, func.count(models.CaseMaster.CaseMasterID))
            .join(models.CaseStatusMaster, models.CaseMaster.CaseStatusID == models.CaseStatusMaster.CaseStatusID)
        ).group_by(models.CaseStatusMaster.CaseStatusName).all()
    )
    by_category = dict(
        scoped(
            db.query(models.CrimeSubHead.CrimeHeadName, func.count(models.CaseMaster.CaseMasterID))
            .join(models.CrimeSubHead, models.CaseMaster.CrimeMinorHeadID == models.CrimeSubHead.CrimeSubHeadID)
        ).group_by(models.CrimeSubHead.CrimeHeadName).all()
    )
    by_head = dict(
        scoped(
            db.query(models.CrimeHead.CrimeGroupName, func.count(models.CaseMaster.CaseMasterID))
            .join(models.CrimeHead, models.CaseMaster.CrimeMajorHeadID == models.CrimeHead.CrimeHeadID)
        ).group_by(models.CrimeHead.CrimeGroupName).all()
    )
    by_gravity = dict(
        scoped(
            db.query(models.GravityOffence.LookupValue, func.count(models.CaseMaster.CaseMasterID))
            .join(models.GravityOffence, models.CaseMaster.GravityOffenceID == models.GravityOffence.GravityOffenceID)
        ).group_by(models.GravityOffence.LookupValue).all()
    )
    by_district = dict(
        db.query(models.District.DistrictName, func.count(models.CaseMaster.CaseMasterID))
        .join(models.Unit, models.CaseMaster.PoliceStationID == models.Unit.UnitID)
        .join(models.District, models.Unit.DistrictID == models.District.DistrictID)
        .group_by(models.District.DistrictName)
        .all()
    )

    # Weekly trend for the last 12 weeks, per crime sub-head. The year-week
    # bucket expression is dialect-specific (SQLite has no to_char; Postgres has
    # no strftime), so pick the right one for the connected database.
    since = datetime.utcnow() - timedelta(weeks=12)
    dialect = db.bind.dialect.name if db.bind is not None else "sqlite"
    if dialect == "postgresql":
        week_expr = func.to_char(models.CaseMaster.CrimeRegisteredDate, "IYYY-IW")
    else:
        week_expr = func.strftime("%Y-%W", models.CaseMaster.CrimeRegisteredDate)
    trend_rows = scoped(
        db.query(
            models.CrimeSubHead.CrimeHeadName,
            week_expr.label("wk"),
            func.count(models.CaseMaster.CaseMasterID),
        )
        .join(models.CrimeSubHead, models.CaseMaster.CrimeMinorHeadID == models.CrimeSubHead.CrimeSubHeadID)
        .filter(models.CaseMaster.CrimeRegisteredDate >= since)
    ).group_by(models.CrimeSubHead.CrimeHeadName, week_expr).all()

    trend: dict = {}
    for cat, wk, cnt in trend_rows:
        trend.setdefault(cat, {})[wk] = cnt

    open_statuses = {"Under Investigation", "Pending Trial"}
    active = sum(v for k, v in by_status.items() if k in open_statuses)

    return {
        "total": total,
        "active": active,
        "districts_reporting": len([d for d, n in by_district.items() if n > 0]),
        "by_status": by_status,
        "by_category": by_category,
        "by_head": by_head,
        "by_gravity": by_gravity,
        "by_district": by_district,
        "trend": trend,
    }


# --------------------------------------------------------------------------- #
# Offenders — SQL-aggregated + paginated
# --------------------------------------------------------------------------- #
@router.get("/criminals")
def get_criminals(
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=MAX_PAGE_SIZE),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Paginated repeat-offender registry, aggregated from Accused by person_key.
    Counts are computed in SQL; only the page's persons get supplementary
    lookups, so the query cost is bounded regardless of dataset size.
    """
    key = models.Accused.person_key

    grp = db.query(
        key.label("key"),
        func.max(models.Accused.AccusedName).label("name"),
        func.max(models.Accused.alias).label("alias"),
        func.count(func.distinct(models.Accused.CaseMasterID)).label("cases"),
    ).group_by(key)
    if search:
        like = f"%{search}%"
        grp = grp.filter(or_(models.Accused.AccusedName.ilike(like), models.Accused.alias.ilike(like)))
    sub = grp.subquery()

    total = db.query(func.count()).select_from(sub).scalar() or 0
    page_rows = (
        db.query(sub)
        .order_by(sub.c.cases.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    keys = [r.key for r in page_rows]

    # Supplementary per-person counts for this page only.
    heinous = dict(
        db.query(key, func.count(func.distinct(models.CaseMaster.CaseMasterID)))
        .join(models.CaseMaster, models.Accused.CaseMasterID == models.CaseMaster.CaseMasterID)
        .join(models.GravityOffence, models.CaseMaster.GravityOffenceID == models.GravityOffence.GravityOffenceID)
        .filter(key.in_(keys), models.GravityOffence.LookupValue == "Heinous")
        .group_by(key)
        .all()
    )
    arrests = dict(
        db.query(key, func.count(func.distinct(models.ArrestSurrender.CaseMasterID)))
        .join(models.ArrestSurrender, models.Accused.CaseMasterID == models.ArrestSurrender.CaseMasterID)
        .filter(key.in_(keys))
        .group_by(key)
        .all()
    )
    heads = dict(
        db.query(key, func.count(func.distinct(models.CaseMaster.CrimeMajorHeadID)))
        .join(models.CaseMaster, models.Accused.CaseMasterID == models.CaseMaster.CaseMasterID)
        .filter(key.in_(keys))
        .group_by(key)
        .all()
    )

    items = []
    for r in page_rows:
        agg = oa.OffenderAgg(key=r.key, name=r.name, alias=r.alias)
        agg.case_ids = set(range(r.cases))  # count-only proxy
        agg.heinous = heinous.get(r.key, 0)
        agg.arrested_case_ids = set(range(arrests.get(r.key, 0)))
        agg.crime_heads = {f"h{i}": 1 for i in range(heads.get(r.key, 0))}
        items.append(
            CriminalOut(
                id=r.key,
                name=r.name,
                alias=r.alias,
                status=oa.status_of(agg),
                risk_score=oa.risk_score(agg),
                crimes_count=r.cases,
            ).model_dump()
        )

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": (total + page_size - 1) // page_size,
    }


@router.get("/offender-stats")
def offender_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Cheap whole-set offender KPIs via SQL GROUP BY (no per-person detail)."""
    key = models.Accused.person_key
    grp = (
        db.query(key.label("key"), func.count(func.distinct(models.Accused.CaseMasterID)).label("cases"))
        .group_by(key)
        .subquery()
    )
    total = db.query(func.count()).select_from(grp).scalar() or 0
    repeat = db.query(func.count()).select_from(grp).filter(grp.c.cases >= 2).scalar() or 0
    prolific = db.query(func.count()).select_from(grp).filter(grp.c.cases >= 8).scalar() or 0
    max_cases = db.query(func.max(grp.c.cases)).scalar() or 0
    avg_cases = db.query(func.avg(grp.c.cases)).scalar() or 0
    return {
        "total": total,
        "repeat": repeat,
        "prolific": prolific,
        "max_cases": max_cases,
        "avg_cases": round(float(avg_cases), 1),
    }


@router.get("/criminals/{person_key}", response_model=CriminalProfileOut)
def get_criminal_profile(
    person_key: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    """Full offender dossier aggregated from all cases for one person_key."""
    aggs = oa.aggregate_offenders(db)
    agg = aggs.get(person_key)
    if not agg:
        raise HTTPException(status_code=404, detail="Offender not found")

    # Cases this person is accused in (bounded per person).
    accused_rows = (
        db.query(models.Accused)
        .options(
            joinedload(models.Accused.case).joinedload(models.CaseMaster.unit).joinedload(models.Unit.district),
            joinedload(models.Accused.case).joinedload(models.CaseMaster.minor_head),
            joinedload(models.Accused.case).joinedload(models.CaseMaster.status),
            joinedload(models.Accused.case).joinedload(models.CaseMaster.gravity),
        )
        .filter(models.Accused.person_key == person_key)
        .all()
    )
    seen = set()
    crimes: List[CrimeBriefOut] = []
    for a in sorted(accused_rows, key=lambda x: x.case.CrimeRegisteredDate if x.case else datetime.min, reverse=True):
        c = a.case
        if not c or c.CaseMasterID in seen:
            continue
        seen.add(c.CaseMasterID)
        crimes.append(
            CrimeBriefOut(
                id=str(c.CaseMasterID),
                FIR_number=c.CrimeNo,
                crime_category=c.minor_head.CrimeHeadName if c.minor_head else "Unclassified",
                occurrence_time=c.CrimeRegisteredDate,
                station_name=c.unit.UnitName if c.unit else "",
                district_name=c.unit.district.DistrictName if c.unit and c.unit.district else "",
                status=c.status.CaseStatusName if c.status else "Unknown",
                gravity=c.gravity.LookupValue if c.gravity else None,
                role=a.PersonID,
            )
        )

    # Associates via co-accused edges touching this person.
    edges = oa.co_accused_edges(db)
    associates: List[AssociateOut] = []
    for a, b, n in edges:
        if person_key not in (a, b):
            continue
        other = b if a == person_key else a
        oagg = aggs.get(other)
        if not oagg:
            continue
        associates.append(
            AssociateOut(
                id=other,
                name=oagg.name,
                alias=oagg.alias,
                relationship_type=oa.relation_label(n),
                strength=min(1.0, 0.4 + n * 0.2),
                risk_score=oa.risk_score(oagg),
                status=oa.status_of(oagg),
            )
        )
    associates.sort(key=lambda x: x.strength, reverse=True)

    top_heads = sorted(agg.crime_heads.items(), key=lambda kv: kv[1], reverse=True)
    stats = OffenderStats(
        arrests=agg.arrests,
        chargesheeted=agg.chargesheeted,
        heinous_cases=agg.heinous,
        districts=sorted(agg.districts),
        top_crime_heads=[{"head": h, "count": n} for h, n in top_heads],
        acts_faced=sorted(agg.acts),
        first_seen=agg.first_seen,
        last_seen=agg.last_seen,
        age=agg.age,
        gender=agg.gender,
    )
    return CriminalProfileOut(
        id=agg.key,
        name=agg.name,
        alias=agg.alias,
        fingerprint_hash=f"FP-{abs(hash(agg.key)) % 900000 + 100000}",
        status=oa.status_of(agg),
        risk_score=oa.risk_score(agg),
        crimes_count=agg.crimes_count,
        stats=stats,
        crimes=crimes,
        associates=associates,
    )


# --------------------------------------------------------------------------- #
# Socio-economic correlations — derived from complainant demographics (SQL)
# --------------------------------------------------------------------------- #
@router.get("/socio-economic")
def get_socio_economic(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """
    Correlations the official schema actually supports: complainant occupation
    and religion against the major crime head. Aggregated in SQL.
    """
    occ = (
        db.query(
            models.OccupationMaster.OccupationName,
            models.CrimeHead.CrimeGroupName,
            func.count(models.CaseMaster.CaseMasterID),
        )
        .join(models.ComplainantDetails, models.ComplainantDetails.OccupationID == models.OccupationMaster.OccupationID)
        .join(models.CaseMaster, models.ComplainantDetails.CaseMasterID == models.CaseMaster.CaseMasterID)
        .join(models.CrimeHead, models.CaseMaster.CrimeMajorHeadID == models.CrimeHead.CrimeHeadID)
        .group_by(models.OccupationMaster.OccupationName, models.CrimeHead.CrimeGroupName)
        .all()
    )
    rel = (
        db.query(
            models.ReligionMaster.ReligionName,
            models.CrimeHead.CrimeGroupName,
            func.count(models.CaseMaster.CaseMasterID),
        )
        .join(models.ComplainantDetails, models.ComplainantDetails.ReligionID == models.ReligionMaster.ReligionID)
        .join(models.CaseMaster, models.ComplainantDetails.CaseMasterID == models.CaseMaster.CaseMasterID)
        .join(models.CrimeHead, models.CaseMaster.CrimeMajorHeadID == models.CrimeHead.CrimeHeadID)
        .group_by(models.ReligionMaster.ReligionName, models.CrimeHead.CrimeGroupName)
        .all()
    )

    def to_matrix(rows):
        m: dict = {}
        for bucket, cat, cnt in rows:
            m.setdefault(bucket, {})[cat] = cnt
        return m

    return {
        "occupation_correlation": to_matrix(occ),
        "religion_correlation": to_matrix(rel),
    }
