"""
Seed a coherent Karnataka Police FIR dataset across the full schema
(docs/fir-schema.md): geography, org, legal framework, crime classification,
then ~180 cases each with complainant / victims / accused / act-sections and,
where applicable, arrests and chargesheets.

Accused are drawn from a fixed pool (with a stable `person_key`) so the same
person recurs across cases — that is what powers repeat-offender tracking and
the co-accused network. Idempotent: no-ops if users already exist.
"""
import random
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.core import security
from app.db import models
from app.db.database import Base, SessionLocal, engine

RNG = random.Random(20260726)  # deterministic seed for reproducible demos

DISTRICTS = [
    ("Bengaluru Urban", 12.9716, 77.5946),
    ("Mysuru", 12.2958, 76.6394),
    ("Hubballi-Dharwad", 15.3647, 75.1240),
    ("Mangaluru", 12.9141, 74.8560),
    ("Belagavi", 15.8497, 74.4977),
    ("Kalaburagi", 17.3297, 76.8343),
]

CASE_CATEGORIES = [("FIR", 1), ("UDR", 3), ("PAR", 4), ("Zero FIR", 8)]
GRAVITIES = ["Heinous", "Non-Heinous"]
STATUSES = ["Under Investigation", "Charge Sheeted", "Pending Trial", "Disposed", "Closed"]

# Crime head -> sub-heads, and each sub-head -> (act, [sections]), gravity, category
CRIME_TAXONOMY = {
    "Crimes Against Body": {
        "Murder": ("IPC", ["302"], "Heinous"),
        "Attempt to Murder": ("IPC", ["307"], "Heinous"),
        "Grievous Hurt": ("IPC", ["325", "326"], "Non-Heinous"),
        "Kidnapping": ("IPC", ["363", "365"], "Heinous"),
    },
    "Crimes Against Property": {
        "Theft": ("IPC", ["379"], "Non-Heinous"),
        "House Burglary": ("IPC", ["454", "457"], "Non-Heinous"),
        "Robbery": ("IPC", ["392"], "Heinous"),
        "Dacoity": ("IPC", ["395"], "Heinous"),
    },
    "Crimes Against Women": {
        "Assault on Woman": ("IPC", ["354"], "Non-Heinous"),
        "Dowry Harassment": ("Dowry Act", ["3", "4"], "Non-Heinous"),
        "Sexual Offence": ("POCSO", ["4", "6"], "Heinous"),
    },
    "Economic Offences": {
        "Cheating": ("IPC", ["420"], "Non-Heinous"),
        "Forgery": ("IPC", ["465", "468"], "Non-Heinous"),
    },
    "Cyber Crimes": {
        "Online Financial Fraud": ("IT Act", ["66C", "66D"], "Non-Heinous"),
        "Identity Theft": ("IT Act", ["66C"], "Non-Heinous"),
    },
    "Narcotics": {
        "Drug Possession": ("NDPS", ["20", "22"], "Non-Heinous"),
        "Drug Trafficking": ("NDPS", ["21", "29"], "Heinous"),
    },
    "Special & Local Laws": {
        "Illicit Arms": ("Arms Act", ["25"], "Non-Heinous"),
        "Excise Violation": ("Excise Act", ["32", "34"], "Non-Heinous"),
    },
}

ACTS = {
    "IPC": "Indian Penal Code, 1860",
    "NDPS": "Narcotic Drugs and Psychotropic Substances Act, 1985",
    "IT Act": "Information Technology Act, 2000",
    "Arms Act": "Arms Act, 1959",
    "Excise Act": "Karnataka Excise Act, 1965",
    "POCSO": "Protection of Children from Sexual Offences Act, 2012",
    "Dowry Act": "Dowry Prohibition Act, 1961",
}

SECTION_DESCRIPTIONS = {
    "302": "Punishment for murder",
    "307": "Attempt to murder",
    "325": "Voluntarily causing grievous hurt",
    "326": "Grievous hurt by dangerous weapons",
    "363": "Punishment for kidnapping",
    "365": "Kidnapping with intent to confine",
    "379": "Punishment for theft",
    "454": "Lurking house-trespass",
    "457": "House-breaking by night",
    "392": "Punishment for robbery",
    "395": "Punishment for dacoity",
    "354": "Assault on woman with intent to outrage modesty",
    "420": "Cheating and dishonestly inducing delivery of property",
    "465": "Punishment for forgery",
    "468": "Forgery for purpose of cheating",
    "66C": "Identity theft (IT Act)",
    "66D": "Cheating by personation using computer resource",
    "20": "Possession of cannabis",
    "22": "Possession of psychotropic substances",
    "21": "Contravention re: manufactured drugs",
    "29": "Abetment and criminal conspiracy (NDPS)",
    "25": "Punishment for illegal possession of arms",
    "32": "Excise offence",
    "34": "Excise offence (possession)",
    "3": "Penalty for giving or taking dowry",
    "4": "Penalty for demanding dowry",
    "6": "Aggravated penetrative sexual assault (POCSO)",
}

RANKS = ["Constable", "Head Constable", "ASI", "Sub-Inspector", "Inspector", "DSP", "SP"]
DESIGNATIONS = ["Investigating Officer", "Station House Officer", "Case Writer", "Circle Inspector"]
CASTES = ["General", "OBC", "SC", "ST", "Not Recorded"]
RELIGIONS = ["Hindu", "Muslim", "Christian", "Jain", "Other"]
OCCUPATIONS = [
    "Farmer", "Daily Wage Labourer", "Government Employee", "Business",
    "Student", "Homemaker", "Driver", "Software Professional", "Unemployed", "Shopkeeper",
]

FIRST_NAMES = [
    "Ramesh", "Suresh", "Manjunath", "Girish", "Anil", "Prakash", "Ravi", "Naveen",
    "Shankar", "Basavaraj", "Mahesh", "Santosh", "Kiran", "Vinay", "Lokesh", "Nagaraj",
    "Deepak", "Harish", "Umesh", "Vijay", "Praveen", "Ganesh", "Mallikarjun", "Yogesh",
]
SURNAMES = ["Gowda", "Reddy", "Patil", "Naik", "Shetty", "Kumar", "Rao", "Hegde", "Desai", "Poojary"]

# Fixed accused pool → recurrence yields repeat offenders + networks.
ACCUSED_POOL = [
    ("Ramesh Kumar", "Blade Ramesh"), ("Siddaraju", "Sidda"), ("Muniraju", "Muni"),
    ("Gopal", "Lakkasandra Gopi"), ("Anand", "Double Anand"), ("Kariyappa", "Karri"),
    ("Manjunatha", "Manju"), ("Lokesh", "Loki"), ("Shankar", "Mico Shankar"),
    ("Yogesh", "Cycle Yogi"), ("Girish", "Snake Giri"), ("Somappa", "Soma"),
    ("Venkatesh", "Venki"), ("Nagaraj", "Naga"), ("Sunil Gowda", "Silent Sunil"),
    ("Harisha", "Harry"), ("Basava", "BSV"), ("Imtiaz", "Immu"),
    ("Prakash Rao", "PK"), ("Dinesh", "Dina"), ("Salman", "Sallu"), ("Ravi Teja", "RT"),
]

VICTIM_NAMES = [
    "Lakshmi", "Geetha", "Rajanna", "Fathima", "Anitha", "Chandru", "Bhagya", "Ismail",
    "Sarojamma", "Naseema", "Kempaiah", "Roopa", "Nagesh", "Sunitha", "Ashwath",
]

BRIEF_FACTS = {
    "Murder": "Deceased found with fatal injuries; body shifted for post-mortem, investigation under murder sections.",
    "Attempt to Murder": "Accused attacked complainant with a lethal weapon; victim hospitalised in critical condition.",
    "Grievous Hurt": "Group clash over old enmity resulting in grievous injuries to the complainant party.",
    "Kidnapping": "Minor allegedly abducted from near the bus stand; search and investigation initiated.",
    "Theft": "Valuables and cash stolen from residence during the absence of the occupants.",
    "House Burglary": "House-breaking reported at night; almirah broken open and gold ornaments taken.",
    "Robbery": "Complainant waylaid by motorcycle-borne accused and robbed of cash and mobile phone.",
    "Dacoity": "Armed gang entered the premises, threatened inmates and looted valuables.",
    "Assault on Woman": "Accused outraged the modesty of the complainant near her workplace.",
    "Dowry Harassment": "Complainant harassed for additional dowry by in-laws; case registered under Dowry Act.",
    "Sexual Offence": "Case registered under POCSO on the complaint of the guardian; victim shifted for examination.",
    "Cheating": "Complainant induced to part with money on false promise of a job/investment return.",
    "Forgery": "Forged documents used to fraudulently transfer property; registration records manipulated.",
    "Online Financial Fraud": "Unauthorised transfer from complainant's bank account through phishing/OTP fraud.",
    "Identity Theft": "Accused impersonated the complainant using cloned SIM and stolen credentials.",
    "Drug Possession": "Contraband seized during vehicle check; accused could not produce valid documents.",
    "Drug Trafficking": "Organised distribution network detected; consignment seized and accused apprehended.",
    "Illicit Arms": "Country-made firearm and live rounds recovered from the possession of the accused.",
    "Excise Violation": "Illicitly distilled liquor seized; accused booked under Excise Act.",
}


def _pad4(n: int) -> str:
    return f"{n % 10000:04d}"


def seed_db() -> None:
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        if db.query(models.User).first():
            print("Database already contains data. Seeding aborted.")
            return

        # --- Users ---
        print("Seeding users...")
        db.add_all([
            models.User(username="admin", email="admin@ksp.gov",
                        password_hash=security.hash_password("admin123"), role="admin"),
            models.User(username="officer", email="officer@ksp.gov",
                        password_hash=security.hash_password("officer123"), role="officer"),
            models.User(username="executive", email="executive@ksp.gov",
                        password_hash=security.hash_password("executive123"), role="scrb_executive"),
        ])

        # --- State & districts ---
        print("Seeding geography...")
        state = models.State(StateName="Karnataka", NationalityID=1)
        db.add(state)
        db.flush()

        districts = []
        for name, lat, lng in DISTRICTS:
            d = models.District(DistrictName=name, StateID=state.StateID, latitude=lat, longitude=lng)
            db.add(d)
            db.flush()
            districts.append(d)

        ut_ps = models.UnitType(UnitTypeName="Police Station", CityDistState="City", Hierarchy=3)
        ut_circle = models.UnitType(UnitTypeName="Circle Office", CityDistState="District", Hierarchy=2)
        db.add_all([ut_ps, ut_circle])
        db.flush()

        # --- Units (stations) & courts ---
        units, courts = [], []
        for d in districts:
            circle = models.Unit(UnitName=f"{d.DistrictName} Circle", StationCode=_pad4(9000 + d.DistrictID),
                                 TypeID=ut_circle.UnitTypeID, StateID=state.StateID, DistrictID=d.DistrictID)
            db.add(circle)
            db.flush()
            for i in range(1, RNG.randint(4, 6)):
                u = models.Unit(
                    UnitName=f"{d.DistrictName} PS {i}",
                    StationCode=_pad4(d.DistrictID * 10 + i),
                    TypeID=ut_ps.UnitTypeID, ParentUnit=circle.UnitID,
                    StateID=state.StateID, DistrictID=d.DistrictID,
                )
                db.add(u)
                db.flush()
                units.append(u)
            for c in range(1, RNG.randint(2, 3)):
                court = models.Court(CourtName=f"{d.DistrictName} JMFC Court-{c}",
                                     DistrictID=d.DistrictID, StateID=state.StateID)
                db.add(court)
                db.flush()
                courts.append(court)

        # --- Ranks, designations, employees ---
        print("Seeding org & personnel...")
        ranks = []
        for i, rn in enumerate(RANKS):
            r = models.Rank(RankName=rn, Hierarchy=len(RANKS) - i)
            db.add(r)
            db.flush()
            ranks.append(r)
        desigs = []
        for i, dn in enumerate(DESIGNATIONS):
            de = models.Designation(DesignationName=dn, SortOrder=i + 1)
            db.add(de)
            db.flush()
            desigs.append(de)

        employees = []
        for u in units:
            for _ in range(RNG.randint(2, 4)):
                emp = models.Employee(
                    DistrictID=u.DistrictID, UnitID=u.UnitID,
                    RankID=RNG.choice(ranks).RankID, DesignationID=RNG.choice(desigs).DesignationID,
                    KGID=f"KG{RNG.randint(100000, 999999)}",
                    FirstName=f"{RNG.choice(FIRST_NAMES)} {RNG.choice(SURNAMES)}",
                    EmployeeDOB=datetime(RNG.randint(1975, 1998), RNG.randint(1, 12), RNG.randint(1, 28)).date(),
                    GenderID=RNG.choice([1, 1, 1, 2]),
                    AppointmentDate=datetime(RNG.randint(2005, 2020), RNG.randint(1, 12), RNG.randint(1, 28)).date(),
                )
                db.add(emp)
                db.flush()
                employees.append(emp)
        emp_by_unit = {}
        for e in employees:
            emp_by_unit.setdefault(e.UnitID, []).append(e)

        # --- Categories / gravity / status ---
        categories = []
        for name, code in CASE_CATEGORIES:
            c = models.CaseCategory(LookupValue=name, CategoryCode=code)
            db.add(c)
            db.flush()
            categories.append(c)
        cat_fir = categories[0]
        gravities = {}
        for g in GRAVITIES:
            go = models.GravityOffence(LookupValue=g)
            db.add(go)
            db.flush()
            gravities[g] = go
        statuses = []
        for s in STATUSES:
            st = models.CaseStatusMaster(CaseStatusName=s)
            db.add(st)
            db.flush()
            statuses.append(st)

        # --- Acts & sections ---
        print("Seeding legal framework...")
        for code, desc in ACTS.items():
            db.add(models.Act(ActCode=code, ActDescription=desc, ShortName=code))
        db.flush()
        section_lookup = {}  # (act, code) -> Section
        for head_name, subs in CRIME_TAXONOMY.items():
            for sub, (act, secs, _grav) in subs.items():
                for sc in secs:
                    key = (act, sc)
                    if key not in section_lookup:
                        s = models.Section(ActCode=act, SectionCode=sc,
                                           SectionDescription=SECTION_DESCRIPTIONS.get(sc, ""))
                        db.add(s)
                        db.flush()
                        section_lookup[key] = s

        # --- Crime heads / sub-heads ---
        heads, subheads = {}, {}
        for head_name, subs in CRIME_TAXONOMY.items():
            h = models.CrimeHead(CrimeGroupName=head_name)
            db.add(h)
            db.flush()
            heads[head_name] = h
            for seq, (sub, (act, secs, grav)) in enumerate(subs.items(), start=1):
                sh = models.CrimeSubHead(CrimeHeadID=h.CrimeHeadID, CrimeHeadName=sub, SeqID=seq)
                db.add(sh)
                db.flush()
                subheads[sub] = (sh, h, act, secs, grav)
                for sc in secs:
                    db.add(models.CrimeHeadActSection(CrimeHeadID=h.CrimeHeadID, ActCode=act, SectionCode=sc))

        # --- Lookups for people ---
        castes = []
        for c in CASTES:
            m = models.CasteMaster(caste_master_name=c)
            db.add(m); db.flush(); castes.append(m)
        religions = []
        for r in RELIGIONS:
            m = models.ReligionMaster(ReligionName=r)
            db.add(m); db.flush(); religions.append(m)
        occupations = []
        for o in OCCUPATIONS:
            m = models.OccupationMaster(OccupationName=o)
            db.add(m); db.flush(); occupations.append(m)
        db.commit()

        # --- Accused person pool (stable identities) ---
        accused_pool = []
        for full, alias in ACCUSED_POOL:
            accused_pool.append({
                "name": full, "alias": alias, "key": full.lower().replace(" ", "_"),
                "age": RNG.randint(21, 52), "gender": RNG.choice(["M", "M", "M", "F"]),
            })

        # --- Cases ---
        print("Seeding cases (FIRs) with people, acts and outcomes...")
        subhead_names = list(subheads.keys())
        serial_counters = {}
        one_off_counter = 0
        year = 2026

        for _ in range(400):
            unit = RNG.choice(units)
            district = next(d for d in districts if d.DistrictID == unit.DistrictID)
            category = cat_fir if RNG.random() < 0.82 else RNG.choice(categories)
            sub_name = RNG.choice(subhead_names)
            sh, head, act, secs, grav = subheads[sub_name]
            gravity = gravities[grav]
            status = RNG.choice(statuses)
            officer = RNG.choice(emp_by_unit.get(unit.UnitID) or employees)

            skey = (unit.StationCode, category.CategoryCode, year)
            serial_counters[skey] = serial_counters.get(skey, 0) + 1
            serial = serial_counters[skey]
            crime_no = f"{category.CategoryCode}{_pad4(district.DistrictID)}{unit.StationCode}{year}{serial:05d}"
            case_no = f"{year}{serial:05d}"

            reg = datetime.utcnow() - timedelta(days=RNG.randint(1, 365), hours=RNG.randint(0, 23))
            inc_from = reg - timedelta(hours=RNG.randint(1, 72))

            case = models.CaseMaster(
                CrimeNo=crime_no, CaseNo=case_no, CrimeRegisteredDate=reg,
                PolicePersonID=officer.EmployeeID, PoliceStationID=unit.UnitID,
                CaseCategoryID=category.CaseCategoryID, GravityOffenceID=gravity.GravityOffenceID,
                CrimeMajorHeadID=head.CrimeHeadID, CrimeMinorHeadID=sh.CrimeSubHeadID,
                CaseStatusID=status.CaseStatusID,
                CourtID=(RNG.choice([c for c in courts if c.DistrictID == district.DistrictID]).CourtID
                         if status.CaseStatusName in ("Charge Sheeted", "Pending Trial", "Disposed") else None),
                IncidentFromDate=inc_from, IncidentToDate=reg, InfoReceivedPSDate=reg,
                latitude=district.latitude + RNG.uniform(-0.08, 0.08),
                longitude=district.longitude + RNG.uniform(-0.08, 0.08),
                BriefFacts=BRIEF_FACTS.get(sub_name, "Case registered and taken up for investigation."),
            )
            db.add(case)
            db.flush()

            # complainant
            db.add(models.ComplainantDetails(
                CaseMasterID=case.CaseMasterID,
                ComplainantName=f"{RNG.choice(FIRST_NAMES)} {RNG.choice(SURNAMES)}",
                AgeYear=RNG.randint(19, 65),
                OccupationID=RNG.choice(occupations).OccupationID,
                ReligionID=RNG.choice(religions).ReligionID,
                CasteID=RNG.choice(castes).caste_master_id,
                GenderID=RNG.choice([1, 2]),
            ))

            # victims (body/women crimes)
            if head.CrimeGroupName in ("Crimes Against Body", "Crimes Against Women"):
                for _v in range(RNG.randint(1, 2)):
                    db.add(models.Victim(
                        CaseMasterID=case.CaseMasterID, VictimName=RNG.choice(VICTIM_NAMES),
                        AgeYear=RNG.randint(6, 70), GenderID=RNG.choice(["M", "F", "F"]),
                        VictimPolice="0",
                    ))

            # Accused: a realistic mix. Most cases involve one-time offenders
            # (unique person_key); a minority pull in the known network pool
            # (recurring, and co-occurring → co-accused network edges).
            chosen: list[dict] = []
            roll = RNG.random()
            if roll < 0.15:
                chosen.extend(RNG.sample(accused_pool, 2))  # co-accused pair from the ring
            elif roll < 0.45:
                chosen.append(RNG.choice(accused_pool))      # one ring member
            for _ in range(RNG.randint(1, 2)):               # plus unique one-offs
                one_off_counter += 1
                chosen.append({
                    "name": f"{RNG.choice(FIRST_NAMES)} {RNG.choice(SURNAMES)}",
                    "alias": None,
                    "key": f"oneoff_{one_off_counter}",
                    "age": RNG.randint(19, 55),
                    "gender": RNG.choice(["M", "M", "M", "F"]),
                })
            case_accused = []
            for i, p in enumerate(chosen, start=1):
                a = models.Accused(
                    CaseMasterID=case.CaseMasterID, AccusedName=p["name"], AgeYear=p["age"],
                    GenderID=p["gender"], PersonID=f"A{i}", person_key=p["key"], alias=p["alias"],
                )
                db.add(a)
                db.flush()
                case_accused.append(a)

            # act-sections for the sub-head
            for order, sc in enumerate(secs, start=1):
                sec = section_lookup[(act, sc)]
                db.add(models.ActSectionAssociation(
                    CaseMasterID=case.CaseMasterID, ActID=act, SectionID=sec.SectionID,
                    ActOrderID=1, SectionOrderID=order,
                ))

            # arrests + chargesheet for progressed cases
            if status.CaseStatusName in ("Charge Sheeted", "Pending Trial", "Disposed") or RNG.random() < 0.4:
                arrest = models.ArrestSurrender(
                    CaseMasterID=case.CaseMasterID, ArrestSurrenderTypeID=RNG.choice([1, 1, 2]),
                    ArrestSurrenderDate=(reg + timedelta(days=RNG.randint(1, 30))).date(),
                    ArrestSurrenderStateId=state.StateID, ArrestSurrenderDistrictId=district.DistrictID,
                    PoliceStationID=unit.UnitID, IOID=officer.EmployeeID,
                    CourtID=case.CourtID, AccusedMasterID=case_accused[0].AccusedMasterID,
                    IsAccused=True,
                )
                db.add(arrest)
                db.flush()
                for a in case_accused:
                    db.add(models.InvArrestSurrenderAccused(
                        ArrestSurrenderID=arrest.ArrestSurrenderID, AccusedMasterID=a.AccusedMasterID))

            if status.CaseStatusName in ("Charge Sheeted", "Pending Trial", "Disposed"):
                db.add(models.ChargesheetDetails(
                    CaseMasterID=case.CaseMasterID,
                    csdate=reg + timedelta(days=RNG.randint(20, 90)),
                    cstype=RNG.choice(["A", "A", "A", "C"]),
                    PolicePersonID=officer.EmployeeID,
                ))
            elif status.CaseStatusName == "Closed":
                db.add(models.ChargesheetDetails(
                    CaseMasterID=case.CaseMasterID, csdate=reg + timedelta(days=RNG.randint(30, 120)),
                    cstype=RNG.choice(["B", "C"]), PolicePersonID=officer.EmployeeID,
                ))

        db.commit()
        print("Database seeded successfully with full FIR schema data.")
    except Exception as exc:
        db.rollback()
        print(f"Error seeding database: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_db()
