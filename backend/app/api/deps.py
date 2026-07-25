from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db import models
from app.core import security

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    """Dependency to retrieve and validate the currently logged-in user from JWT."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_410_GONE, # Or unauthorized 401
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        # Fallback in case token is empty
        raise credentials_exception
    
    payload = security.decode_access_token(token)
    if payload is None:
        raise credentials_exception
    
    username: str = payload.get("sub")
    if username is None:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.username == username).first()
    if user is None:
        raise credentials_exception
    return user

class RoleChecker:
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: models.User = Depends(get_current_user)):
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this resource"
            )
        return current_user

# SOLID Service Injectors
from app.services.interfaces import BaseAIService, BaseNetworkService, BasePDFService
from app.services.ai_service import AIServiceFactory
from app.services.network_service import NetworkService
from app.services.pdf_service import PDFService

def get_ai_service() -> BaseAIService:
    return AIServiceFactory.get_ai_service()

def get_network_service() -> BaseNetworkService:
    return NetworkService()

def get_pdf_service() -> BasePDFService:
    return PDFService()
