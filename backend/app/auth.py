from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
from fastapi.security import OAuth2PasswordBearer, HTTPBearer, HTTPAuthorizationCredentials

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
http_bearer   = HTTPBearer()          # this adds the Bearer field in Swagger UI

SECRET_KEY = os.getenv("JWT_SECRET", "fallback_secret")
ALGORITHM  = os.getenv("JWT_ALGORITHM", "HS256")
EXPIRE_MIN = int(os.getenv("JWT_EXPIRE_MINUTES", 60))

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=EXPIRE_MIN)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = int(payload.get("sub"))
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.User_ID == user_id).first()
    if user is None or not user.Is_Active:
        raise credentials_exception
    return user