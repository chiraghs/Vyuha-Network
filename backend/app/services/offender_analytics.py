"""
Offender & network analytics derived from the FIR schema.

The official schema has no global "criminal" or "network" table — an accused is
recorded per case. This module resolves the same person across cases by
`person_key`, derives a recidivism risk score and a status, and infers the
co-accused network (two people linked when they appear on the same case).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session, joinedload

from app.db import models


@dataclass
class OffenderAgg:
    key: str
    name: str
    alias: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    case_ids: Set[int] = field(default_factory=set)
    districts: Set[str] = field(default_factory=set)
    crime_heads: Dict[str, int] = field(default_factory=dict)
    acts: Set[str] = field(default_factory=set)
    heinous: int = 0
    arrested_case_ids: Set[int] = field(default_factory=set)
    chargesheeted: int = 0
    first_seen: Optional[datetime] = None
    last_seen: Optional[datetime] = None

    @property
    def crimes_count(self) -> int:
        return len(self.case_ids)

    @property
    def arrests(self) -> int:
        return len(self.arrested_case_ids)


def aggregate_offenders(db: Session) -> Dict[str, OffenderAgg]:
    """Resolve accused rows into per-person aggregates keyed by person_key."""
    accused = (
        db.query(models.Accused)
        .options(
            joinedload(models.Accused.case).joinedload(models.CaseMaster.unit).joinedload(models.Unit.district),
            joinedload(models.Accused.case).joinedload(models.CaseMaster.major_head),
            joinedload(models.Accused.case).joinedload(models.CaseMaster.gravity),
            joinedload(models.Accused.case).joinedload(models.CaseMaster.act_sections),
        )
        .all()
    )

    # Cases that resulted in an arrest, and cases with a valid chargesheet (type A).
    arrested_cases = {a.CaseMasterID for a in db.query(models.ArrestSurrender).all()}
    chargesheeted_cases = {
        c.CaseMasterID for c in db.query(models.ChargesheetDetails).filter(models.ChargesheetDetails.cstype == "A").all()
    }

    aggs: Dict[str, OffenderAgg] = {}
    for a in accused:
        key = a.person_key or a.AccusedName.lower().replace(" ", "_")
        agg = aggs.get(key)
        if agg is None:
            agg = OffenderAgg(key=key, name=a.AccusedName, alias=a.alias, age=a.AgeYear, gender=a.GenderID)
            aggs[key] = agg
        case = a.case
        if case is None or case.CaseMasterID in agg.case_ids:
            # still record district/head once per case; skip duplicate case
            if case is not None:
                pass
            continue
        agg.case_ids.add(case.CaseMasterID)
        if case.unit and case.unit.district:
            agg.districts.add(case.unit.district.DistrictName)
        if case.major_head:
            agg.crime_heads[case.major_head.CrimeGroupName] = (
                agg.crime_heads.get(case.major_head.CrimeGroupName, 0) + 1
            )
        if case.gravity and case.gravity.LookupValue == "Heinous":
            agg.heinous += 1
        for asc in case.act_sections:
            agg.acts.add(asc.ActID)
        if case.CaseMasterID in arrested_cases:
            agg.arrested_case_ids.add(case.CaseMasterID)
        if case.CaseMasterID in chargesheeted_cases:
            agg.chargesheeted += 1
        reg = case.CrimeRegisteredDate
        if reg:
            agg.first_seen = min(agg.first_seen or reg, reg)
            agg.last_seen = max(agg.last_seen or reg, reg)
    return aggs


def risk_score(agg: OffenderAgg) -> float:
    """Composite recidivism risk 0–100 from volume, gravity and arrests."""
    base = 22
    volume = min(40, agg.crimes_count * 3.2)
    heinous = min(24, agg.heinous * 6)
    breadth = min(8, len(agg.crime_heads) * 2)
    evasion = 6 if agg.crimes_count >= 4 and agg.arrests == 0 else 0
    return round(min(99.0, base + volume + heinous + breadth + evasion), 1)


def status_of(agg: OffenderAgg) -> str:
    if agg.crimes_count == 0:
        return "Active"
    arrest_ratio = agg.arrests / agg.crimes_count
    if arrest_ratio >= 0.5:
        return "In Custody"
    if agg.crimes_count >= 4 and agg.arrests == 0:
        return "Absconding"
    return "Active"


def co_accused_edges(db: Session) -> List[Tuple[str, str, int]]:
    """(person_key_a, person_key_b, shared_case_count) for people sharing cases."""
    rows = db.query(models.Accused.CaseMasterID, models.Accused.person_key).all()
    by_case: Dict[int, Set[str]] = {}
    for case_id, key in rows:
        if key:
            by_case.setdefault(case_id, set()).add(key)

    pair_counts: Dict[Tuple[str, str], int] = {}
    for keys in by_case.values():
        ks = sorted(keys)
        for i in range(len(ks)):
            for j in range(i + 1, len(ks)):
                pair = (ks[i], ks[j])
                pair_counts[pair] = pair_counts.get(pair, 0) + 1
    return [(a, b, n) for (a, b), n in pair_counts.items()]


RELATION_BY_STRENGTH = [
    (4, "Habitual Associates"),
    (3, "Frequent Accomplices"),
    (2, "Known Accomplices"),
    (1, "Co-accused"),
]


def relation_label(shared: int) -> str:
    for threshold, label in RELATION_BY_STRENGTH:
        if shared >= threshold:
            return label
    return "Co-accused"
