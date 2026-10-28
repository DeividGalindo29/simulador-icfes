
from typing import Dict
from datetime import datetime

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

import models
import schemas
from database import get_db
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


app = FastAPI(title="Simulador ICFES API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)


# ------------------- AUTENTICACIÓN -------------------

def obtener_usuario_actual(
    credenciales: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    if not credenciales:
        raise HTTPException(
            status_code=401,
            detail="Debes iniciar sesión."
        )

    datos = decode_access_token(credenciales.credentials)

    if not datos or not datos.get("sub"):
        raise HTTPException(
            status_code=401,
            detail="La sesión expiró o el token no es válido."
        )

    try:
        usuario_id = int(datos["sub"])
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=401,
            detail="Token inválido."
        )

    usuario = db.query(models.Usuario).filter(
        models.Usuario.id == usuario_id
    ).first()

    if not usuario:
        raise HTTPException(
            status_code=401,
            detail="El usuario no existe."
        )

    return usuario


# ------------------- REGISTRO -------------------

@app.post("/usuarios", status_code=201)
@app.post("/usuarios/", status_code=201)
def crear_usuario(
    datos: schemas.UsuarioCreate,
    db: Session = Depends(get_db)
):
    correo = str(datos.correo).strip().lower()

    existente = db.query(models.Usuario).filter(
        models.Usuario.correo == correo
    ).first()

    if existente:
        raise HTTPException(
            status_code=409,
            detail="Este correo ya está registrado. Inicia sesión."
        )

    nuevo_usuario = models.Usuario(
        nombre=datos.nombre.strip(),
        colegio=datos.colegio,
        correo=correo,
        password_hash=hash_password(datos.password),
    )

    try:
        db.add(nuevo_usuario)
        db.flush()

        progreso = models.ProgresoSimulacion(
            usuario_id=nuevo_usuario.id,
            respuestas={},
            indice_actual=0,
        )
        db.add(progreso)
        db.commit()
        db.refresh(nuevo_usuario)

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="No se pudo registrar el usuario. Verifica el correo."
        )

    return {
        "mensaje": "Usuario registrado correctamente.",
        "usuario": {
            "id": nuevo_usuario.id,
            "nombre": nuevo_usuario.nombre,
            "colegio": nuevo_usuario.colegio,
            "correo": nuevo_usuario.correo,
        }
    }


# ------------------- INICIO DE SESIÓN -------------------

@app.post("/login")
@app.post("/login/")
def iniciar_sesion(
    datos: schemas.UsuarioLogin,
    db: Session = Depends(get_db)
):
    correo = str(datos.correo).strip().lower()

    usuario = db.query(models.Usuario).filter(
        models.Usuario.correo == correo
    ).first()

    if (
        not usuario
        or not usuario.password_hash
        or not verify_password(datos.password, usuario.password_hash)
    ):
        raise HTTPException(
            status_code=401,
            detail="Correo o contraseña incorrectos."
        )

    token = create_access_token(usuario.id)

    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": {
            "id": usuario.id,
            "nombre": usuario.nombre,
            "colegio": usuario.colegio,
            "correo": usuario.correo,
        }
    }


# ------------------- USUARIO ACTUAL -------------------

@app.get("/usuarios/me")
def mi_usuario(
    usuario: models.Usuario = Depends(obtener_usuario_actual)
):
    return {
        "id": usuario.id,
        "nombre": usuario.nombre,
        "colegio": usuario.colegio,
        "correo": usuario.correo,
    }


# ------------------- PREGUNTAS -------------------

@app.get("/preguntas")
@app.get("/preguntas/")
def obtener_preguntas(
    limit: int = 100,
    db: Session = Depends(get_db)
):
    if limit < 1 or limit > 500:
        raise HTTPException(
            status_code=400,
            detail="El límite debe estar entre 1 y 500."
        )

    return db.query(models.Pregunta).limit(limit).all()


# ------------------- GUARDAR PROGRESO -------------------

@app.put("/progreso")
@app.put("/progreso/")
def guardar_progreso(
    payload: schemas.ProgresoCreate,
    usuario: models.Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    progreso = db.query(models.ProgresoSimulacion).filter(
        models.ProgresoSimulacion.usuario_id == usuario.id
    ).first()

    if not progreso:
        progreso = models.ProgresoSimulacion(
            usuario_id=usuario.id,
            respuestas={},
            indice_actual=0,
        )
        db.add(progreso)

    progreso.respuestas = payload.respuestas
    progreso.indice_actual = payload.indice_actual
    progreso.actualizado_en = datetime.utcnow()

    db.commit()
    db.refresh(progreso)

    return {
        "mensaje": "Progreso guardado correctamente.",
        "respuestas": progreso.respuestas,
        "indice_actual": progreso.indice_actual,
        "actualizado_en": progreso.actualizado_en,
    }


# ------------------- RECUPERAR PROGRESO -------------------

@app.get("/progreso")
@app.get("/progreso/")
def recuperar_progreso(
    usuario: models.Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    progreso = db.query(models.ProgresoSimulacion).filter(
        models.ProgresoSimulacion.usuario_id == usuario.id
    ).first()

    if not progreso:
        return {
            "respuestas": {},
            "indice_actual": 0,
        }

    return {
        "respuestas": progreso.respuestas,
        "indice_actual": progreso.indice_actual,
        "actualizado_en": progreso.actualizado_en,
    }


# ------------------- RESULTADOS -------------------

@app.post("/resultados")
@app.post("/resultados/")
def guardar_resultado(
    payload: schemas.ResultadoCreate,
    usuario: models.Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    if payload.usuario_id != usuario.id:
        raise HTTPException(
            status_code=403,
            detail="No puedes guardar resultados para otro usuario."
        )

    if (
        payload.puntaje < 0
        or payload.total_preguntas < 1
        or payload.puntaje > payload.total_preguntas
    ):
        raise HTTPException(
            status_code=400,
            detail="Los valores del resultado no son válidos."
        )

    nuevo_resultado = models.Resultado(
        usuario_id=usuario.id,
        puntaje=payload.puntaje,
        total_preguntas=payload.total_preguntas,
    )

    db.add(nuevo_resultado)
    db.commit()
    db.refresh(nuevo_resultado)

    return {
        "id": nuevo_resultado.id,
        "usuario_id": nuevo_resultado.usuario_id,
        "puntaje": nuevo_resultado.puntaje,
        "total_preguntas": nuevo_resultado.total_preguntas,
        "fecha": nuevo_resultado.fecha,
    }


# ------------------- HISTORIAL DE RESULTADOS -------------------

@app.get("/resultados/mis-resultados")
def mis_resultados(
    usuario: models.Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    resultados = db.query(models.Resultado).filter(
        models.Resultado.usuario_id == usuario.id
    ).order_by(models.Resultado.fecha.desc()).all()

    return [
        {
            "id": resultado.id,
            "puntaje": resultado.puntaje,
            "total_preguntas": resultado.total_preguntas,
            "fecha": resultado.fecha,
        }
        for resultado in resultados
    ]
