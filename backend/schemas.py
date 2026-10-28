
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict


class UsuarioCreate(BaseModel):
    nombre: str
    colegio: Optional[str] = None
    correo: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UsuarioLogin(BaseModel):
    correo: EmailStr
    password: str


class UsuarioResponse(BaseModel):
    id: int
    nombre: str
    colegio: Optional[str] = None
    correo: Optional[str] = None

    class Config:
        from_attributes = True


class PreguntaResponse(BaseModel):
    id: int
    materia: str
    contexto: Optional[str] = None
    enunciado: str
    opcion_a: str
    opcion_b: str
    opcion_c: str
    opcion_d: str

    class Config:
        from_attributes = True


class ResultadoCreate(BaseModel):
    usuario_id: int
    puntaje: int
    total_preguntas: int


class ProgresoCreate(BaseModel):
    respuestas: Dict[str, str] = Field(default_factory=dict)
    indice_actual: int = Field(default=0, ge=0)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioResponse
