from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.schemas import NetworkGraph
from app.services.interfaces import BaseNetworkService
from app.api.deps import get_current_user, get_network_service
from app.db import models

router = APIRouter(prefix="/network", tags=["Criminal Link Analysis"])

@router.get("", response_model=NetworkGraph)
def get_network(
    db: Session = Depends(get_db), 
    network_service: BaseNetworkService = Depends(get_network_service),
    current_user: models.User = Depends(get_current_user)
):
    """Fetch nodes and edges of the criminal accomplice networks."""
    return network_service.get_criminal_network(db)
