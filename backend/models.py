
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    colegio = Column(String(150), nullable=True)
    correo = Column(String(100), nullable=True, unique=True, index=True)
    password_hash = Column(String(255), nullable=True)

    resultados = relationship("Resultado", back_populates="usuario")


class Pregunta(Base):
    __tablename__ = "preguntas"

    id = Column(Integer, primary_key=True, index=True)
    materia = Column(String(100), nullable=False)
    contexto = Column(Text, nullable=True)
    enunciado = Column(Text, nullable=False)
    opcion_a = Column(Text, nullable=False)
    opcion_b = Column(Text, nullable=False)
    opcion_c = Column(Text, nullable=False)
    opcion_d = Column(Text, nullable=False)
    respuesta_correcta = Column(String(10), nullable=False)


class Resultado(Base):
    __tablename__ = "resultados"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(
        Integer,
        ForeignKey("usuarios.id"),
        nullable=False
    )
    puntaje = Column(Integer, nullable=False)
    total_preguntas = Column(Integer, nullable=False)
    fecha = Column(DateTime, default=datetime.utcnow)

    usuario = relationship("Usuario", back_populates="resultados")


class ProgresoSimulacion(Base):
    __tablename__ = "progresos_simulacion"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(
        Integer,
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        unique=True
    )
    respuestas = Column(JSONB, nullable=False, default=dict)
    indice_actual = Column(Integer, nullable=False, default=0)
    actualizado_en = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )
