from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.db.database import get_db
from app.db import models
from app.schemas import DistrictOut, StationOut, CrimeRecordOut, CriminalOut
from app.api.deps import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics & Crimes"])

@router.get("/districts", response_model=List[DistrictOut])
def get_districts(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """List all districts of Karnataka."""
    return db.query(models.District).all()

@router.get("/stations", response_model=List[StationOut])
def get_stations(
    district_id: Optional[int] = None, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_user)
):
    """List all police stations, optionally filtered by district."""
    query = db.query(models.PoliceStation)
    if district_id:
        query = query.filter(models.PoliceStation.district_id == district_id)
    
    stations = query.all()
    # Format out matching the schema
    result = []
    for s in stations:
        result.append({
            "id": s.id,
            "name": s.name,
            "station_code": s.station_code,
            "district_name": s.district.name
        })
    return result

@router.get("/crimes", response_model=List[CrimeRecordOut])
def get_crimes(
    district_id: Optional[int] = None,
    station_id: Optional[int] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Search and filter registered FIR records from KSP database."""
    query = db.query(models.CrimeRecord).join(models.PoliceStation)
    
    if district_id:
        query = query.filter(models.PoliceStation.district_id == district_id)
    if station_id:
        query = query.filter(models.CrimeRecord.station_id == station_id)
    if category:
        query = query.filter(models.CrimeRecord.crime_category == category)
    if search:
        query = query.filter(
            models.CrimeRecord.FIR_number.icontains(search) | 
            models.CrimeRecord.description.icontains(search)
        )
        
    crimes = query.order_by(models.CrimeRecord.occurrence_time.desc()).all()
    
    result = []
    for c in crimes:
        result.append({
            "id": c.id,
            "FIR_number": c.FIR_number,
            "station_name": c.station.name,
            "district_name": c.station.district.name,
            "occurrence_time": c.occurrence_time,
            "crime_category": c.crime_category,
            "description": c.description,
            "latitude": c.latitude,
            "longitude": c.longitude,
            "status": c.status,
            "socio_economic_factors": c.socio_economic_factors
        })
    return result

@router.get("/criminals", response_model=List[CriminalOut])
def get_criminals(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retrieve criminal list with crime counts and recidivism risk scores."""
    query = db.query(models.Criminal)
    if search:
        query = query.filter(
            models.Criminal.name.icontains(search) | 
            models.Criminal.alias.icontains(search)
        )
    criminals = query.all()
    
    result = []
    for c in criminals:
        result.append({
            "id": c.id,
            "name": c.name,
            "alias": c.alias,
            "status": c.status,
            "risk_score": c.risk_score,
            "crimes_count": len(c.crimes)
        })
    return result

@router.get("/hotspots")
def get_hotspots(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Aggregate crime locations to render geospatial hotspots."""
    query = db.query(models.CrimeRecord)
    if category:
        query = query.filter(models.CrimeRecord.crime_category == category)
    crimes = query.all()
    
    hotspots = []
    for c in crimes:
        hotspots.append({
            "id": c.id,
            "FIR_number": c.FIR_number,
            "category": c.crime_category,
            "lat": c.latitude,
            "lng": c.longitude,
            "weight": 1.0, # Hotspot density weight
            "status": c.status,
            "station": c.station.name,
            "occurrence_time": c.occurrence_time.isoformat()
        })
    return hotspots

@router.get("/socio-economic")
def get_socio_economic(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Aggregate crime count correlations grouped by socio-economic profiles."""
    crimes = db.query(models.CrimeRecord).all()
    
    # Analyze correlations
    unemployment_correlation = {}
    poverty_correlation = {}
    
    for c in crimes:
        factors = c.socio_economic_factors
        if not factors:
            continue
            
        unemp = factors.get("unemployment_rate", 0)
        poverty = factors.get("poverty_index", "Unknown")
        cat = c.crime_category
        
        # Group unemployment
        unemp_bucket = f"{int(unemp // 5) * 5}-{int(unemp // 5) * 5 + 5}%"
        if unemp_bucket not in unemployment_correlation:
            unemployment_correlation[unemp_bucket] = {}
        unemployment_correlation[unemp_bucket][cat] = unemployment_correlation[unemp_bucket].get(cat, 0) + 1
        
        # Group poverty
        if poverty not in poverty_correlation:
            poverty_correlation[poverty] = {}
        poverty_correlation[poverty][cat] = poverty_correlation[poverty].get(cat, 0) + 1
        
    return {
        "unemployment_correlation": unemployment_correlation,
        "poverty_correlation": poverty_correlation
    }
