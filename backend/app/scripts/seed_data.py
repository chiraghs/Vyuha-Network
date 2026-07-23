import random
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, engine, Base
from app.db import models
from app.core import security

# Coordinates mapping for major Karnataka districts/cities
DISTRICT_COORDINATES = {
    "Bengaluru Urban": {"lat": 12.9716, "lng": 77.5946},
    "Mysuru": {"lat": 12.2958, "lng": 76.6394},
    "Hubballi-Dharwad": {"lat": 15.3647, "lng": 75.1240},
    "Mangaluru": {"lat": 12.9141, "lng": 74.8560},
    "Belagavi": {"lat": 15.8497, "lng": 74.4977},
    "Kalaburagi": {"lat": 17.3297, "lng": 76.8343}
}

CRIME_CATEGORIES = ["Theft", "Assault", "Cybercrime", "Narcotics", "Land Dispute", "Homicide", "Extortion", "Burglary"]

SOCIO_ECONOMIC_PROFILES = [
    {"unemployment_rate": 12.4, "literacy_rate": 81.2, "poverty_index": "High", "alcohol_consumption": "High"},
    {"unemployment_rate": 8.5, "literacy_rate": 89.0, "poverty_index": "Medium", "alcohol_consumption": "Medium"},
    {"unemployment_rate": 4.2, "literacy_rate": 93.5, "poverty_index": "Low", "alcohol_consumption": "Low"},
    {"unemployment_rate": 15.1, "literacy_rate": 72.8, "poverty_index": "Very High", "alcohol_consumption": "High"},
    {"unemployment_rate": 6.8, "literacy_rate": 85.4, "poverty_index": "Medium", "alcohol_consumption": "Low"},
]

def seed_db():
    # 1. Create tables
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    try:
        # Check if users already exist to avoid seeding twice
        if db.query(models.User).first():
            print("Database already contains data. Seeding aborted.")
            return

        print("Seeding Users...")
        users = [
            models.User(
                username="admin",
                email="admin@ksp.gov",
                password_hash=security.hash_password("admin123"),
                role="admin"
            ),
            models.User(
                username="officer",
                email="officer@ksp.gov",
                password_hash=security.hash_password("officer123"),
                role="officer"
            ),
            models.User(
                username="executive",
                email="executive@ksp.gov",
                password_hash=security.hash_password("executive123"),
                role="scrb_executive"
            )
        ]
        db.add_all(users)
        db.commit()

        print("Seeding Districts and Stations...")
        districts = []
        stations = []
        
        for idx, (dist_name, coords) in enumerate(DISTRICT_COORDINATES.items(), start=1):
            district = models.District(
                name=dist_name,
                headquarter=dist_name.replace(" Urban", "")
            )
            db.add(district)
            db.flush() # Populate district ID
            districts.append(district)

            # Create 3-5 stations per district
            for i in range(1, random.randint(4, 6)):
                code_prefix = dist_name[:3].upper().replace(" ", "")
                station = models.PoliceStation(
                    name=f"{dist_name} Station {i}",
                    station_code=f"KSP-{code_prefix}-0{i}",
                    district_id=district.id
                )
                db.add(station)
                stations.append(station)
        
        db.commit()

        print("Seeding Criminal Profiles...")
        criminals_data = [
            ("Kariyappa", "Karri", "FP-88716A", "Active", 82.5),
            ("Siddaraju", "Sidda", "FP-99021B", "Active", 71.0),
            ("Ramesh Kumar", "Blade Ramesh", "FP-11234C", "Active", 94.0),
            ("Sunil Gowda", "Silent Sunil", "FP-22312D", "Active", 45.0),
            ("Yogesh", "Cycle Yogi", "FP-44567E", "Active", 78.5),
            ("Girish", "Snake Giri", "FP-55678F", "In Custody", 62.0),
            ("Anand", "Double Anand", "FP-66789G", "Absconding", 88.0),
            ("Muniraju", "Muni", "FP-77890H", "Active", 85.5),
            ("Gopal", "Lakkasandra Gopi", "FP-11002I", "Active", 90.0),
            ("Nagaraj", "Naga", "FP-22003J", "In Custody", 35.0),
            ("Somappa", "Soma", "FP-33004K", "Active", 68.0),
            ("Venkatesh", "Venki", "FP-44005L", "Active", 75.0),
            ("Shankar", "Mico Shankar", "FP-55006M", "Active", 81.5),
            ("Harisha", "Harry", "FP-66007N", "In Custody", 50.0),
            ("Manjunatha", "Manju", "FP-77008O", "Active", 89.0),
            ("Lokesh", "Loki", "FP-88009P", "Active", 92.5),
        ]
        
        criminals = []
        for name, alias, fp, status, risk in criminals_data:
            criminal = models.Criminal(
                name=name,
                alias=alias,
                fingerprint_hash=fp,
                status=status,
                risk_score=risk
            )
            db.add(criminal)
            db.flush()
            criminals.append(criminal)
        db.commit()

        print("Seeding Crime Records...")
        # Create around 80 crime records spread across Karnataka cities
        crimes = []
        for idx in range(1, 91):
            station = random.choice(stations)
            district_name = station.district.name
            center_coords = DISTRICT_COORDINATES[district_name]
            
            # Scatter coordinates slightly around the city center (approx. within 10-15 km)
            lat = center_coords["lat"] + random.uniform(-0.08, 0.08)
            lng = center_coords["lng"] + random.uniform(-0.08, 0.08)
            
            category = random.choice(CRIME_CATEGORIES)
            
            # Simple description generation
            desc_templates = {
                "Theft": f"Theft of valuables reported at local residence/shop near coordinates. Suspect entered through backdoor.",
                "Assault": f"Physical altercation reported between two groups over minor issues, resulting in injuries.",
                "Cybercrime": f"Phishing scam and unauthorized bank transfer from victim accounts using cloned numbers.",
                "Narcotics": f"Illegal possession and distribution of banned narcotics substances seized during vehicle inspection.",
                "Land Dispute": f"Violent clash over boundary demarcation and land ownership between neighboring families.",
                "Homicide": f"Body found with blunt force trauma marks, registered under murder investigation sections.",
                "Extortion": f"Threat calls made to local businessmen demanding protection money by alleged gang associates.",
                "Burglary": f"Break-in reported at a closed commercial establishment during night hours, electronic safes breached."
            }
            
            occurrence_time = datetime.utcnow() - timedelta(days=random.randint(1, 365), hours=random.randint(0, 23))
            
            crime = models.CrimeRecord(
                FIR_number=f"FIR/{occurrence_time.year}/{station.station_code}/{100 + idx}",
                station_id=station.id,
                occurrence_time=occurrence_time,
                crime_category=category,
                description=desc_templates[category],
                latitude=lat,
                longitude=lng,
                status=random.choice(["Under Investigation", "Solved", "Closed", "Open"]),
                socio_economic_factors=random.choice(SOCIO_ECONOMIC_PROFILES)
            )
            db.add(crime)
            db.flush()
            crimes.append(crime)
            
            # Assign random suspects to crime (about 70% of crimes have suspects)
            if random.random() < 0.7:
                suspects_count = random.randint(1, 3)
                chosen_suspects = random.sample(criminals, suspects_count)
                for sus in chosen_suspects:
                    db.execute(
                        models.crime_criminals.insert().values(
                            crime_id=crime.id,
                            criminal_id=sus.id,
                            role=random.choice(["Suspect", "Prime Suspect", "Accomplice"])
                        )
                    )
        
        db.commit()

        print("Seeding Criminal Networks (Links)...")
        # Generate network links between criminals based on shared crimes or direct associations
        network_links = [
            (criminals[0].id, criminals[1].id, "Accomplice", 0.8),
            (criminals[0].id, criminals[2].id, "Boss-Henchman", 0.9),
            (criminals[1].id, criminals[4].id, "Associate", 0.6),
            (criminals[2].id, criminals[3].id, "Partner", 0.75),
            (criminals[4].id, criminals[5].id, "Supplier-Buyer", 0.85),
            (criminals[6].id, criminals[7].id, "Accomplice", 0.7),
            (criminals[7].id, criminals[8].id, "Boss-Henchman", 0.9),
            (criminals[8].id, criminals[9].id, "Partner", 0.8),
            (criminals[9].id, criminals[10].id, "Rivals", 0.4),
            (criminals[10].id, criminals[11].id, "Accomplice", 0.65),
            (criminals[11].id, criminals[12].id, "Associate", 0.55),
            (criminals[12].id, criminals[13].id, "Accomplice", 0.75),
            (criminals[13].id, criminals[14].id, "Partner", 0.7),
            (criminals[14].id, criminals[15].id, "Boss-Henchman", 0.95),
            (criminals[1].id, criminals[8].id, "Associate", 0.5),
            (criminals[2].id, criminals[14].id, "Supplier-Buyer", 0.8),
        ]
        
        for criminal_a, criminal_b, rel_type, strength in network_links:
            net = models.CriminalNetwork(
                criminal_a=criminal_a,
                criminal_b=criminal_b,
                relationship_type=rel_type,
                strength=strength
            )
            db.add(net)
        
        db.commit()
        print("Database seeded successfully with rich KSP records!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
