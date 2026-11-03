
import json
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models
from database import SessionLocal, engine


DATA_DIR = Path(__file__).resolve().parent / "data"


def cargar_preguntas_json():
    """Carga preguntas de los JSON sin borrar los registros existentes."""

    models.Base.metadata.create_all(bind=engine)

    archivos_json = sorted(DATA_DIR.glob("*.json"))

    if not archivos_json:
        print(f"No se encontraron archivos JSON en: {DATA_DIR}")
        return

    db = SessionLocal()

    try:
        agregadas = 0
        omitidas = 0

        for archivo in archivos_json:
            print(f"\nLeyendo: {archivo.name}")

            try:
                with archivo.open("r", encoding="utf-8-sig") as f:
                    preguntas = json.load(f)
            except (OSError, json.JSONDecodeError) as error:
                print(f"No se pudo leer {archivo.name}: {error}")
                continue

            if not isinstance(preguntas, list):
                print(f"Se omite {archivo.name}: debe contener una lista JSON.")
                continue

            for numero, p in enumerate(preguntas, start=1):
                campos_obligatorios = [
                    "materia",
                    "enunciado",
                    "opcion_a",
                    "opcion_b",
                    "opcion_c",
                    "opcion_d",
                    "respuesta_correcta",
                ]

                if not isinstance(p, dict) or any(
                    not isinstance(p.get(campo), str) or not p[campo].strip()
                    for campo in campos_obligatorios
                ):
                    print(
                        f"Pregunta {numero} inválida en {archivo.name}; se omite."
                    )
                    omitidas += 1
                    continue

                respuesta = p["respuesta_correcta"].strip().upper()
                if respuesta not in {"A", "B", "C", "D"}:
                    print(
                        f"Respuesta correcta inválida en {archivo.name}, "
                        f"pregunta {numero}; se omite."
                    )
                    omitidas += 1
                    continue

                nueva = {
                    campo: p[campo].strip()
                    for campo in campos_obligatorios
                }
                nueva["respuesta_correcta"] = respuesta
                nueva["contexto"] = p.get("contexto")

                # Evita duplicados exactos por materia y enunciado.
                existente = (
                    db.query(models.Pregunta)
                    .filter(
                        models.Pregunta.materia == nueva["materia"],
                        models.Pregunta.enunciado == nueva["enunciado"],
                    )
                    .first()
                )

                if existente:
                    omitidas += 1
                    continue

                db.add(models.Pregunta(**nueva))
                agregadas += 1

        db.commit()

        print("\nCarga terminada.")
        print(f"Preguntas nuevas agregadas: {agregadas}")
        print(f"Preguntas omitidas o duplicadas: {omitidas}")
        print("No se eliminaron usuarios, resultados, progresos ni preguntas.")

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    cargar_preguntas_json()
