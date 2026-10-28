import os
import json
from sqlalchemy import text
from database import SessionLocal, engine
import models

def poblar_base_datos():
    # 1. Eliminar de forma segura cualquier tabla huérfana o dependiente con CASCADE
    with engine.connect() as connection:
        connection.execute(text("DROP TABLE IF EXISTS resultados, resultados_simulacion, preguntas, usuarios CASCADE;"))
        connection.commit()

    # 2. Recrear la estructura de tablas desde models.py
    models.Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    total_registradas = 0
    carp_data = os.path.join(os.path.dirname(__file__), 'data')

    if not os.path.exists(carp_data):
        print(f"Error: La carpeta '{carp_data}' no existe.")
        return

    # 3. Cargar automáticamente todos los archivos .json dentro de backend/data/
    for archivo in os.listdir(carp_data):
        if archivo.endswith('.json'):
            ruta_archivo = os.path.join(carp_data, archivo)
            with open(ruta_archivo, 'r', encoding='utf-8-sig') as f:
                preguntas_materia = json.load(f)
                
                for p in preguntas_materia:
                    nueva_p = models.Pregunta(**p)
                    db.add(nueva_p)
                    total_registradas += 1
                print(f"✔ Cargado archivo: {archivo} ({len(preguntas_materia)} preguntas)")

    db.commit()
    db.close()
    print(f"\n¡Éxito total! Se han importado {total_registradas} preguntas en total en Neon PostgreSQL.")

if __name__ == "__main__":
    poblar_base_datos()