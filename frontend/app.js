
const API_URL = "http://127.0.0.1:8000";

const CLAVE_SESION = "simulador_icfes_sesion_v1";
const CLAVE_TOKEN = "simulador_icfes_token_v1";
const CLAVE_USUARIO = "simulador_icfes_usuario_v1";
const PREFIJO_FINALIZADA = "simulador_icfes_finalizada_v1_";

const $ = (id) => document.getElementById(id);

let usuarioActual = null;
let preguntas = [];
let indiceActual = 0;
let respuestasSeleccionadas = {};
let contextoVisible = null;
let ocupado = false;
let finalizando = false;
let modoAcceso = "registro";
let temporizadorProgreso = null;

document.addEventListener("DOMContentLoaded", () => {
    $("form-registro")?.addEventListener("submit", registrarUsuario);
    $("form-login")?.addEventListener("submit", iniciarSesion);
    $("btn-cambiar-acceso")?.addEventListener("click", cambiarModoAcceso);
    $("btn-ir-preguntas")?.addEventListener("click", irAPreguntas);
    $("btn-ver-lectura")?.addEventListener("click", volverALectura);
    $("btn-anterior")?.addEventListener("click", anteriorPregunta);
    $("btn-siguiente")?.addEventListener("click", siguientePregunta);
    $("btn-finalizar")?.addEventListener("click", confirmarFinalizar);
    $("btn-reiniciar")?.addEventListener("click", reiniciarSimulador);
    $("btn-cerrar-sesion")?.addEventListener("click", cerrarSesion);

    configurarModoAcceso();
    recuperarSesion();

    window.addEventListener("offline", () => {
        mostrarAlerta(
            "No hay conexión. Tus respuestas siguen guardadas en este dispositivo.",
            "info"
        );
    });

    window.addEventListener("online", () => {
        mostrarAlerta(
            "La conexión volvió. Intentaremos sincronizar tu progreso.",
            "info"
        );
        sincronizarProgresoServidor();
    });
});

// =====================================================
// REGISTRO E INICIO DE SESIÓN
// =====================================================

function configurarModoAcceso() {
    mostrarVista("campos-registro", modoAcceso === "registro");
    mostrarVista("form-login", modoAcceso === "login");

    if ($("titulo-acceso")) {
        $("titulo-acceso").textContent =
            modoAcceso === "registro"
                ? "Prepárate para tu simulacro"
                : "Inicia sesión";
    }

    if ($("texto-acceso")) {
        $("texto-acceso").textContent =
            modoAcceso === "registro"
                ? "Crea tu cuenta para comenzar. Tu progreso podrá guardarse y recuperarse."
                : "Ingresa con el correo y la contraseña de tu cuenta para continuar.";
    }

    if ($("texto-cambio-acceso")) {
        $("texto-cambio-acceso").textContent =
            modoAcceso === "registro"
                ? "¿Ya tienes una cuenta?"
                : "¿Todavía no tienes una cuenta?";
    }

    if ($("btn-cambiar-acceso")) {
        $("btn-cambiar-acceso").textContent =
            modoAcceso === "registro"
                ? "Iniciar sesión"
                : "Crear cuenta";
    }

    if ($("btn-comenzar")) {
        $("btn-comenzar").textContent = "Crear cuenta y comenzar";
    }

    if ($("btn-login")) {
        $("btn-login").textContent = "Iniciar sesión";
    }
}

function cambiarModoAcceso() {
    modoAcceso = modoAcceso === "registro" ? "login" : "registro";
    ocultarAlerta();
    configurarModoAcceso();
}

async function registrarUsuario(event) {
    event.preventDefault();

    if (ocupado) return;

    const nombre = $("nombre")?.value.trim() || "";
    const colegio = $("colegio")?.value.trim() || "";
    const correo = $("correo")?.value.trim().toLowerCase() || "";
    const password = $("password")?.value || "";

    if (!nombre || !correo || password.length < 8) {
        mostrarAlerta(
            !nombre
                ? "Escribe el nombre del participante."
                : !correo
                    ? "Escribe tu correo electrónico."
                    : "La contraseña debe tener al menos 8 caracteres.",
            "error"
        );
        return;
    }

    ocupado = true;

    if ($("btn-comenzar")) {
        $("btn-comenzar").disabled = true;
        $("btn-comenzar").textContent = "Creando cuenta…";
    }

    ocultarAlerta();

    try {
        const r = await fetch(`${API_URL}/usuarios/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nombre,
                colegio: colegio || null,
                correo,
                password
            })
        });

        if (!r.ok) {
            throw new Error(
                await obtenerMensajeError(r, "No fue posible crear la cuenta.")
            );
        }

        await autenticarYComenzar(correo, password);

    } catch (e) {
        mostrarAlerta(
            e instanceof TypeError
                ? `No se pudo conectar con la API en ${API_URL}. Verifica que esté encendida.`
                : e.message,
            "error"
        );

        mostrarVista("vista-cargando", false);
        mostrarVista("vista-registro", true);

    } finally {
        ocupado = false;

        if ($("btn-comenzar")) {
            $("btn-comenzar").disabled = false;
            $("btn-comenzar").textContent = "Crear cuenta y comenzar";
        }
    }
}

async function iniciarSesion(event) {
    event.preventDefault();

    if (ocupado) return;

    const correo = $("correo-login")?.value.trim().toLowerCase() || "";
    const password = $("password-login")?.value || "";

    if (!correo || !password) {
        mostrarAlerta("Escribe tu correo y contraseña.", "error");
        return;
    }

    ocupado = true;

    if ($("btn-login")) {
        $("btn-login").disabled = true;
        $("btn-login").textContent = "Ingresando…";
    }

    ocultarAlerta();

    try {
        await autenticarYComenzar(correo, password);

    } catch (e) {
        mostrarVista("vista-cargando", false);
        mostrarVista("vista-registro", true);

        mostrarAlerta(
            e instanceof TypeError
                ? `No se pudo conectar con la API en ${API_URL}.`
                : e.message,
            "error"
        );

    } finally {
        ocupado = false;

        if ($("btn-login")) {
            $("btn-login").disabled = false;
            $("btn-login").textContent = "Iniciar sesión";
        }
    }
}

async function autenticarYComenzar(correo, password) {
    mostrarVista("vista-registro", false);
    mostrarVista("vista-cargando", true);
    ocultarAlerta();

    const r = await fetch(`${API_URL}/login/`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ correo, password })
    });

    if (!r.ok) {
        throw new Error(
            await obtenerMensajeError(r, "No fue posible iniciar sesión.")
        );
    }

    const data = await r.json();

    if (!data.access_token || !data.usuario) {
        throw new Error("La API no devolvió los datos de acceso esperados.");
    }

    localStorage.setItem(CLAVE_TOKEN, data.access_token);
    localStorage.setItem(CLAVE_USUARIO, JSON.stringify(data.usuario));

    usuarioActual = data.usuario;

    if (mostrarResultadoGuardado()) return;

    await cargarPreguntasYProgreso();
}

// =====================================================
// RECUPERAR SESIÓN Y PROGRESO
// =====================================================

function guardarSesion() {
    if (!usuarioActual || !preguntas.length) return;

    try {
        localStorage.setItem(
            CLAVE_SESION,
            JSON.stringify({
                usuario: usuarioActual,
                preguntas,
                indiceActual,
                respuestas: respuestasSeleccionadas,
                fechaGuardado: new Date().toISOString()
            })
        );
    } catch (e) {
        console.error("No se pudo guardar la sesión local:", e);
    }
}

async function recuperarSesion() {
    const token = localStorage.getItem(CLAVE_TOKEN);
    const local = localStorage.getItem(CLAVE_SESION);

    if (local) {
        try {
            const s = JSON.parse(local);

            if (
                s.usuario &&
                Array.isArray(s.preguntas) &&
                s.preguntas.length
            ) {
                usuarioActual = s.usuario;

                if (mostrarResultadoGuardado()) return;

                preguntas = s.preguntas;
                respuestasSeleccionadas = s.respuestas || {};
                indiceActual = limitarIndice(
                    s.indiceActual,
                    preguntas.length
                );

                mostrarSimulacion();
                renderizarMapaPreguntas();
                procesarFlujo();
            }

        } catch (e) {
            console.warn("No se pudo recuperar el borrador local:", e);
        }
    }

    if (!token) return;

    try {
        const r = await fetch(`${API_URL}/usuarios/me`, {
            headers: encabezadosAutenticados()
        });

        if (!r.ok) {
            if (r.status === 401 || r.status === 403) {
                cerrarSesionLocal();
            }
            return;
        }

        usuarioActual = await r.json();

        localStorage.setItem(
            CLAVE_USUARIO,
            JSON.stringify(usuarioActual)
        );

        if ($("badge-usuario")) {
            $("badge-usuario").textContent =
                usuarioActual.nombre || "Estudiante";
        }

        if (mostrarResultadoGuardado()) return;

        if (preguntas.length) {
            await recuperarProgresoServidor();
            guardarSesion();
            renderizarMapaPreguntas();
            procesarFlujo();
        } else {
            await cargarPreguntasYProgreso();
        }

    } catch (e) {
        console.warn("No fue posible verificar la sesión:", e);

        if (!preguntas.length) {
            mostrarAlerta(
                "No pudimos verificar tu sesión con el servidor. Revisa la conexión e inténtalo de nuevo.",
                "info"
            );
        }
    }
}

async function cargarPreguntasYProgreso() {
    const r = await fetch(`${API_URL}/preguntas/?limit=500`, {
        headers: encabezadosAutenticados()
    });

    if (!r.ok) {
        throw new Error(
            await obtenerMensajeError(r, "No fue posible cargar las preguntas.")
        );
    }

    const data = await r.json();

    if (!Array.isArray(data) || !data.length) {
        throw new Error("No hay preguntas disponibles en la base de datos.");
    }

    preguntas = data;
    respuestasSeleccionadas = {};
    indiceActual = 0;
    contextoVisible = null;

    await recuperarProgresoServidor();

    guardarSesion();
    mostrarSimulacion();
    renderizarMapaPreguntas();
    procesarFlujo();
    ocultarAlerta();
}

async function recuperarProgresoServidor() {
    if (!localStorage.getItem(CLAVE_TOKEN)) return;

    const r = await fetch(`${API_URL}/progreso/`, {
        headers: encabezadosAutenticados()
    });

    if (!r.ok) {
        throw new Error(
            await obtenerMensajeError(r, "No se pudo recuperar el progreso.")
        );
    }

    const p = await r.json();

    if (p && p.respuestas && typeof p.respuestas === "object") {
        respuestasSeleccionadas = p.respuestas;
    }

    if (preguntas.length) {
        indiceActual = limitarIndice(
            p?.indice_actual ?? 0,
            preguntas.length
        );
    }
}

function mostrarSimulacion() {
    mostrarVista("vista-registro", false);
    mostrarVista("vista-cargando", false);
    mostrarVista("vista-resultados", false);
    mostrarVista("area-simulacion", true);
    mostrarVista("bar-progreso-container", true);

    if ($("badge-usuario")) {
        $("badge-usuario").textContent =
            usuarioActual?.nombre || "Estudiante";
    }
}

function cerrarSesionLocal() {
    localStorage.removeItem(CLAVE_TOKEN);
    localStorage.removeItem(CLAVE_USUARIO);
}

function claveFinalizada(id = usuarioActual?.id) {
    return id == null ? null : `${PREFIJO_FINALIZADA}${id}`;
}

function mostrarResultadoGuardado() {
    const clave = claveFinalizada();

    if (!clave) return false;

    const guardado = localStorage.getItem(clave);

    if (!guardado) return false;

    try {
        const r = JSON.parse(guardado);

        preguntas = r.preguntas || [];
        respuestasSeleccionadas = r.respuestas || {};

        if (r.porArea && Array.isArray(r.porArea)) {
            mostrarResultados(
                r.aciertos || 0,
                new Map(r.porArea)
            );
        } else {
            mostrarVista("vista-registro", false);
            mostrarVista("vista-cargando", false);
            mostrarVista("area-simulacion", true);
            mostrarVista("bar-progreso-container", false);
            mostrarVista("vista-lectura", false);
            mostrarVista("vista-quiz", false);
            mostrarVista("vista-resultados", true);

            if ($("resumen-texto")) {
                $("resumen-texto").textContent =
                    "Esta prueba ya fue finalizada. No puedes volver a responderla.";
            }
        }

        bloquearPruebaFinalizada();
        return true;

    } catch (e) {
        console.warn("No se pudo recuperar el resultado guardado:", e);
        return false;
    }
}

// =====================================================
// BLOQUEO DE LA PRUEBA FINALIZADA
// =====================================================

function bloquearPruebaFinalizada() {
    mostrarVista("vista-registro", false);
    mostrarVista("vista-cargando", false);
    mostrarVista("area-simulacion", true);
    mostrarVista("vista-lectura", false);
    mostrarVista("vista-quiz", false);
    mostrarVista("bar-progreso-container", false);
    mostrarVista("vista-resultados", true);
    mostrarVista("columna-mapa", false);

    if ($("btn-reiniciar")) {
        $("btn-reiniciar").disabled = true;
        $("btn-reiniciar").textContent = "Prueba finalizada";
    }

    if ($("btn-finalizar")) {
        $("btn-finalizar").disabled = true;
    }

    if ($("btn-siguiente")) {
        $("btn-siguiente").disabled = true;
    }

    if ($("btn-anterior")) {
        $("btn-anterior").disabled = true;
    }

    if ($("btn-ir-preguntas")) {
        $("btn-ir-preguntas").disabled = true;
    }

    if ($("btn-ver-lectura")) {
        $("btn-ver-lectura").disabled = true;
    }

    if ($("badge-usuario")) {
        $("badge-usuario").textContent =
            usuarioActual?.nombre || "Estudiante";
    }
}

// =====================================================
// CERRAR SESIÓN
// =====================================================

function cerrarSesion() {
    if (!confirm("¿Deseas cerrar sesión?")) return;

    cerrarSesionLocal();

    localStorage.removeItem(CLAVE_SESION);

    if (temporizadorProgreso) {
        clearTimeout(temporizadorProgreso);
        temporizadorProgreso = null;
    }

    usuarioActual = null;
    preguntas = [];
    respuestasSeleccionadas = {};
    indiceActual = 0;
    contextoVisible = null;
    finalizando = false;

    mostrarVista("area-simulacion", false);
    mostrarVista("bar-progreso-container", false);
    mostrarVista("vista-cargando", false);
    mostrarVista("vista-registro", true);
    mostrarVista("vista-resultados", false);
    mostrarVista("columna-mapa", true);

    if ($("badge-usuario")) {
        $("badge-usuario").textContent = "Invitado";
    }

    modoAcceso = "login";
    configurarModoAcceso();
    ocultarAlerta();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function limitarIndice(valor, total) {
    const n = Number(valor);

    return Number.isFinite(n)
        ? Math.max(0, Math.min(Math.trunc(n), total - 1))
        : 0;
}

function reiniciarSimulador() {
    if (localStorage.getItem(claveFinalizada())) {
        mostrarAlerta(
            "Esta prueba ya fue finalizada y no se puede repetir con esta cuenta.",
            "info"
        );
        return;
    }

    if (!confirm(
        "¿Quieres comenzar una prueba nueva? Se borrará el progreso guardado de esta prueba."
    )) {
        return;
    }

    respuestasSeleccionadas = {};
    indiceActual = 0;
    contextoVisible = null;

    localStorage.removeItem(CLAVE_SESION);

    guardarProgresoServidor()
        .catch(e => console.warn(
            "No se pudo reiniciar el progreso en el servidor:",
            e
        ))
        .finally(() => location.reload());
}

// =====================================================
// SINCRONIZACIÓN CON LA API / NEON
// =====================================================

function encabezadosAutenticados() {
    const h = {
        "Content-Type": "application/json"
    };

    const token = localStorage.getItem(CLAVE_TOKEN);

    if (token) {
        h.Authorization = `Bearer ${token}`;
    }

    return h;
}

async function guardarProgresoServidor() {
    if (
        !usuarioActual ||
        !preguntas.length ||
        !localStorage.getItem(CLAVE_TOKEN)
    ) {
        return;
    }

    const r = await fetch(`${API_URL}/progreso/`, {
        method: "PUT",
        headers: encabezadosAutenticados(),
        body: JSON.stringify({
            respuestas: respuestasSeleccionadas,
            indice_actual: indiceActual
        })
    });

    if (!r.ok) {
        throw new Error(
            await obtenerMensajeError(r, "No se pudo sincronizar el progreso.")
        );
    }
}

function programarSincronizacion() {
    guardarSesion();

    if (temporizadorProgreso) {
        clearTimeout(temporizadorProgreso);
    }

    temporizadorProgreso = setTimeout(
        () => sincronizarProgresoServidor(),
        350
    );
}

async function sincronizarProgresoServidor() {
    try {
        await guardarProgresoServidor();
    } catch (e) {
        console.warn(
            "El progreso queda guardado localmente; sincronización pendiente:",
            e
        );
    }
}

// =====================================================
// VISTAS Y MENSAJES
// =====================================================

function mostrarVista(id, visible) {
    const el = $(id);

    if (el) {
        el.style.display = visible ? "" : "none";
    }
}

async function obtenerMensajeError(response, predeterminado) {
    try {
        const d = await response.json();

        if (typeof d.detail === "string") {
            return d.detail;
        }

        if (Array.isArray(d.detail)) {
            return d.detail.map(x => x.msg || "Dato inválido").join(". ");
        }

        if (typeof d.message === "string") {
            return d.message;
        }

    } catch (_) {}

    return `${predeterminado} (HTTP ${response.status})`;
}

function mostrarAlerta(mensaje, tipo = "error") {
    const el = $("alerta-app");

    if (!el) {
        console.log(mensaje);
        return;
    }

    el.textContent = mensaje;
    el.className = `app-alert ${tipo}`;
    el.hidden = false;
}

function ocultarAlerta() {
    const el = $("alerta-app");

    if (el) {
        el.hidden = true;
        el.textContent = "";
    }
}

// =====================================================
// MAPA Y NAVEGACIÓN
// =====================================================

function renderizarMapaPreguntas() {
    const grid = $("grid-mapa-preguntas");

    if (!grid) return;

    grid.innerHTML = "";

    preguntas.forEach((p, idx) => {
        const b = document.createElement("button");

        b.type = "button";
        b.className = "q-box";
        b.textContent = String(idx + 1);

        b.setAttribute(
            "aria-label",
            `Ir a la pregunta ${idx + 1}`
        );

        b.setAttribute(
            "aria-current",
            idx === indiceActual ? "step" : "false"
        );

        if (
            Object.prototype.hasOwnProperty.call(
                respuestasSeleccionadas,
                idx
            )
        ) {
            b.classList.add("answered");
        }

        if (idx === indiceActual) {
            b.classList.add("current");
        }

        b.addEventListener("click", () => saltarAPregunta(idx));

        grid.appendChild(b);
    });

    actualizarProgreso();
    guardarSesion();
}

function actualizarProgreso() {
    const total = preguntas.length;
    const respondidas = Object.keys(respuestasSeleccionadas).length;

    const porcentaje = total
        ? Math.round(respondidas / total * 100)
        : 0;

    if ($("bar-progreso-fill")) {
        $("bar-progreso-fill").style.width = `${porcentaje}%`;
    }

    if ($("bar-progreso-container")) {
        $("bar-progreso-container").setAttribute(
            "aria-valuenow",
            String(porcentaje)
        );
    }

    if ($("resumen-progreso")) {
        $("resumen-progreso").textContent =
            `${respondidas} de ${total} respondidas`;
    }
}

function saltarAPregunta(i) {
    if (localStorage.getItem(claveFinalizada())) {
        bloquearPruebaFinalizada();
        return;
    }

    if (i < 0 || i >= preguntas.length) return;

    indiceActual = i;

    renderizarMapaPreguntas();
    procesarFlujo();
}

function procesarFlujo() {
    if (localStorage.getItem(claveFinalizada())) {
        bloquearPruebaFinalizada();
        return;
    }

    const p = preguntas[indiceActual];

    if (!p) return;

    const contexto = normalizarTexto(p.contexto);

    if (contexto && contexto !== contextoVisible) {
        mostrarVistaLectura(contexto, p.materia);
    } else {
        mostrarPregunta();
    }

    programarSincronizacion();
}

function mostrarVistaLectura(texto, materia) {
    contextoVisible = texto;

    if ($("lectura-materia-badge")) {
        $("lectura-materia-badge").textContent =
            materia || "Texto de contexto";
    }

    if ($("contenido-lectura")) {
        $("contenido-lectura").textContent = texto;
    }

    mostrarVista("vista-quiz", false);
    mostrarVista("vista-lectura", true);
}

function irAPreguntas() {
    if (localStorage.getItem(claveFinalizada())) {
        bloquearPruebaFinalizada();
        return;
    }

    mostrarVista("vista-lectura", false);
    mostrarVista("vista-quiz", true);

    mostrarPregunta();
}

function volverALectura() {
    if (localStorage.getItem(claveFinalizada())) {
        bloquearPruebaFinalizada();
        return;
    }

    const p = preguntas[indiceActual];
    const contexto = normalizarTexto(p?.contexto);

    if (!contexto) {
        mostrarAlerta(
            "Esta pregunta no tiene un texto de contexto asociado.",
            "info"
        );
        return;
    }

    ocultarAlerta();
    mostrarVistaLectura(contexto, p.materia);
}

// =====================================================
// PREGUNTAS Y RESPUESTAS
// =====================================================

function mostrarPregunta() {
    if (localStorage.getItem(claveFinalizada())) {
        bloquearPruebaFinalizada();
        return;
    }

    const p = preguntas[indiceActual];

    if (!p) return;

    mostrarVista("vista-lectura", false);
    mostrarVista("vista-quiz", true);

    if ($("materia-badge")) {
        $("materia-badge").textContent =
            p.materia || "Área sin especificar";
    }

    if ($("contador-preguntas")) {
        $("contador-preguntas").textContent =
            `Pregunta ${indiceActual + 1} de ${preguntas.length}`;
    }

    if ($("texto-enunciado")) {
        $("texto-enunciado").textContent =
            p.enunciado || "Enunciado no disponible";
    }

    if ($("btn-anterior")) {
        $("btn-anterior").disabled = indiceActual === 0;

        $("btn-anterior").style.visibility =
            indiceActual === 0 ? "hidden" : "visible";
    }

    if ($("btn-siguiente")) {
        $("btn-siguiente").textContent =
            indiceActual === preguntas.length - 1
                ? "Revisar y finalizar →"
                : "Siguiente pregunta →";
    }

    if ($("btn-ver-lectura")) {
        $("btn-ver-lectura").style.display =
            normalizarTexto(p.contexto) ? "" : "none";
    }

    if ($("estado-respuesta")) {
        $("estado-respuesta").textContent =
            Object.prototype.hasOwnProperty.call(
                respuestasSeleccionadas,
                indiceActual
            )
                ? "Tienes una respuesta seleccionada. Puedes cambiarla."
                : "Selecciona la opción que consideres correcta.";
    }

    const cont = $("opciones-container");

    if (!cont) return;

    cont.innerHTML = "";

    [
        { clave: "A", texto: p.opcion_a },
        { clave: "B", texto: p.opcion_b },
        { clave: "C", texto: p.opcion_c },
        { clave: "D", texto: p.opcion_d }
    ].forEach(o => {
        const b = document.createElement("button");

        b.type = "button";
        b.className = "opcion-btn";

        const sel = respuestasSeleccionadas[indiceActual] === o.clave;

        b.setAttribute("aria-pressed", String(sel));

        const letra = document.createElement("span");
        letra.className = "opcion-letra";
        letra.textContent = o.clave;

        const texto = document.createElement("span");
        texto.className = "opcion-texto";
        texto.textContent = o.texto ?? "Opción no disponible";

        b.append(letra, texto);

        if (sel) {
            b.classList.add("seleccionada");
        }

        b.addEventListener("click", () => seleccionarOpcion(o.clave));

        cont.appendChild(b);
    });
}

function seleccionarOpcion(clave) {
    if (localStorage.getItem(claveFinalizada())) {
        bloquearPruebaFinalizada();
        return;
    }

    respuestasSeleccionadas[indiceActual] = clave;

    programarSincronizacion();
    ocultarAlerta();
    renderizarMapaPreguntas();
    mostrarPregunta();
}

function siguientePregunta() {
    if (localStorage.getItem(claveFinalizada())) {
        bloquearPruebaFinalizada();
        return;
    }

    if (indiceActual < preguntas.length - 1) {
        indiceActual++;
        renderizarMapaPreguntas();
        procesarFlujo();
    } else {
        confirmarFinalizar();
    }
}

function anteriorPregunta() {
    if (localStorage.getItem(claveFinalizada())) {
        bloquearPruebaFinalizada();
        return;
    }

    if (indiceActual > 0) {
        indiceActual--;
        renderizarMapaPreguntas();
        procesarFlujo();
    }
}

// =====================================================
// FINALIZAR Y GUARDAR RESULTADOS
// =====================================================

function confirmarFinalizar() {
    if (
        finalizando ||
        !preguntas.length ||
        localStorage.getItem(claveFinalizada())
    ) {
        bloquearPruebaFinalizada();
        return;
    }

    const respondidas = Object.keys(respuestasSeleccionadas).length;
    const faltantes = preguntas.length - respondidas;

    let mensaje =
        `Has respondido ${respondidas} de ${preguntas.length} preguntas.`;

    mensaje += faltantes > 0
        ? `\nTe faltan ${faltantes} preguntas por responder.\n\n¿Deseas finalizar de todos modos?`
        : "\n\n¿Deseas enviar tus respuestas y ver el resultado?";

    if (confirm(mensaje)) {
        finalizarSimulacion();
    }
}

async function finalizarSimulacion() {
    if (finalizando) return;

    if (
        !usuarioActual ||
        !preguntas.length ||
        localStorage.getItem(claveFinalizada())
    ) {
        bloquearPruebaFinalizada();
        return;
    }

    finalizando = true;

    if ($("btn-finalizar")) {
        $("btn-finalizar").disabled = true;
    }

    if ($("btn-siguiente")) {
        $("btn-siguiente").disabled = true;
    }

    ocultarAlerta();

    try {
        let aciertos = 0;
        const porArea = new Map();

        preguntas.forEach((p, i) => {
            const materia = p.materia || "Área sin especificar";

            if (!porArea.has(materia)) {
                porArea.set(materia, {
                    correctas: 0,
                    total: 0
                });
            }

            const r = porArea.get(materia);
            r.total++;

            if (
                normalizarRespuesta(respuestasSeleccionadas[i]) &&
                normalizarRespuesta(respuestasSeleccionadas[i]) ===
                normalizarRespuesta(p.respuesta_correcta)
            ) {
                aciertos++;
                r.correctas++;
            }
        });

        await guardarProgresoServidor();

        const response = await fetch(`${API_URL}/resultados/`, {
            method: "POST",
            headers: encabezadosAutenticados(),
            body: JSON.stringify({
                usuario_id: usuarioActual.id,
                puntaje: aciertos,
                total_preguntas: preguntas.length
            })
        });

        if (!response.ok) {
            throw new Error(
                await obtenerMensajeError(
                    response,
                    "No se pudo guardar el resultado."
                )
            );
        }

        const clave = claveFinalizada();

        // Guardar primero el resultado final para impedir repetir la prueba.
        if (clave) {
            localStorage.setItem(
                clave,
                JSON.stringify({
                    aciertos,
                    total: preguntas.length,
                    porArea: Array.from(porArea.entries()),
                    preguntas,
                    respuestas: respuestasSeleccionadas,
                    fecha: new Date().toISOString()
                })
            );
        }

        localStorage.removeItem(CLAVE_SESION);

        mostrarResultados(aciertos, porArea);
        bloquearPruebaFinalizada();

    } catch (e) {
        guardarSesion();

        mostrarAlerta(
            e instanceof TypeError
                ? "No se pudo conectar con la API. Tu prueba permanece guardada localmente; vuelve a intentarlo cuando haya conexión."
                : `No se pudo finalizar la prueba: ${e.message}`,
            "error"
        );

    } finally {
        finalizando = false;

        if (!localStorage.getItem(claveFinalizada())) {
            if ($("btn-finalizar")) {
                $("btn-finalizar").disabled = false;
            }

            if ($("btn-siguiente")) {
                $("btn-siguiente").disabled = false;
            }
        }
    }
}

function mostrarResultados(aciertos, porArea) {
    const total = preguntas.length;
    const porcentaje = total
        ? Math.round(aciertos / total * 100)
        : 0;

    const respondidas = Object.keys(respuestasSeleccionadas).length;

    if ($("porcentaje-puntaje")) {
        $("porcentaje-puntaje").textContent = `${porcentaje}%`;
    }

    if ($("resumen-texto")) {
        $("resumen-texto").textContent =
            `${usuarioActual?.nombre || "Estudiante"}, acertaste ${aciertos} de ${total} preguntas. Sigue practicando para fortalecer tus habilidades.`;
    }

    if ($("aciertos-resultados")) {
        $("aciertos-resultados").textContent = String(aciertos);
    }

    if ($("total-resultados")) {
        $("total-resultados").textContent = String(total);
    }

    if ($("sin-responder-resultados")) {
        $("sin-responder-resultados").textContent =
            String(total - respondidas);
    }

    const lista = $("resumen-areas");

    if (lista) {
        lista.innerHTML = "";

        for (const [materia, d] of porArea.entries()) {
            const pct = d.total
                ? Math.round(d.correctas / d.total * 100)
                : 0;

            const tarjeta = document.createElement("article");
            tarjeta.className = "subject-result";

            const head = document.createElement("div");
            head.className = "subject-result-heading";

            const nombre = document.createElement("strong");
            nombre.textContent = materia;

            const cifra = document.createElement("span");
            cifra.textContent = `${d.correctas}/${d.total} · ${pct}%`;

            head.append(nombre, cifra);

            const barra = document.createElement("div");
            barra.className = "subject-progress";
            barra.setAttribute("role", "progressbar");
            barra.setAttribute("aria-label", `Resultado en ${materia}`);
            barra.setAttribute("aria-valuemin", "0");
            barra.setAttribute("aria-valuemax", "100");
            barra.setAttribute("aria-valuenow", String(pct));

            const relleno = document.createElement("div");
            relleno.style.width = `${pct}%`;

            barra.appendChild(relleno);
            tarjeta.append(head, barra);
            lista.appendChild(tarjeta);
        }
    }

    // El contenedor principal debe seguir visible para mostrar resultados.
    mostrarVista("area-simulacion", true);
    mostrarVista("vista-lectura", false);
    mostrarVista("vista-quiz", false);
    mostrarVista("bar-progreso-container", false);
    mostrarVista("vista-resultados", true);

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

// =====================================================
// UTILIDADES
// =====================================================

function normalizarTexto(valor) {
    return typeof valor === "string" ? valor.trim() : "";
}

function normalizarRespuesta(valor) {
    return typeof valor === "string"
        ? valor.trim().toUpperCase().replace(/[^A-D]/g, "")
        : "";
}
