
import os
from datetime import datetime, timedelta, timezone

import jwt
from pwdlib import PasswordHash
from dotenv import load_dotenv

load_dotenv()

password_hasher = PasswordHash.recommended()

SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not SECRET_KEY or SECRET_KEY.startswith("REEMPLAZA"):
    raise RuntimeError(
        "Configura una clave aleatoria válida en el archivo .env"
    )

ALGORITHM = "HS256"
TOKEN_MINUTES = 60 * 24 * 7  # 7 días


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_hasher.verify(password, password_hash)


def create_access_token(usuario_id: int) -> str:
    expiration = datetime.now(timezone.utc) + timedelta(
        minutes=TOKEN_MINUTES
    )
    payload = {
        "sub": str(usuario_id),
        "exp": expiration
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str):
    try:
        return jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
    except jwt.PyJWTError:
        return None
