from database import SessionLocal, engine
import models

# Crear las tablas en Neon si no existen todavía
models.Base.metadata.create_all(bind=engine)

def cargar_datos_iniciales():
    db = SessionLocal()
    
    if db.query(models.Pregunta).count() > 0:
        print("La base de datos ya contiene preguntas.")
        db.close()
        return

    preguntas_muestra = [
        {
            "materia": "Lectura Crítica",
            "enunciado": "¿Cuál es la función principal de un texto argumentativo?",
            "opcion_a": "Narrar una historia fantástica.",
            "opcion_b": "Persuadir o convencer al lector sobre una tesis.",
            "opcion_c": "Describir detalladamente un objeto.",
            "opcion_d": "Explicar un experimento científico paso a paso.",
            "respuesta_correcta": "B"
        },
        {
            "materia": "Matemáticas",
            "enunciado": "Si el radio de un círculo se duplica, ¿qué ocurre con su área?",
            "opcion_a": "Se duplica.",
            "opcion_b": "Se triplica.",
            "opcion_c": "Se cuadruplica.",
            "opcion_d": "Permanecerá igual.",
            "respuesta_correcta": "C"
        },
        {
            "materia": "Sociales y Ciudadanas",
            "enunciado": "¿Qué mecanismo constitucional permite a los ciudadanos colombianos proteger sus derechos fundamentales?",
            "opcion_a": "El Plebiscito.",
            "opcion_b": "La Acción de Tutela.",
            "opcion_c": "El Referendo.",
            "opcion_d": "La Consulta Popular.",
            "respuesta_correcta": "B"
        }
    ]

    for p in preguntas_muestra:
        nueva_pregunta = models.Pregunta(**p)
        db.add(nueva_pregunta)

    db.commit()
    db.close()
    print("¡Preguntas iniciales cargadas en Neon PostgreSQL!")

if __name__ == "__main__":
    cargar_datos_iniciales()