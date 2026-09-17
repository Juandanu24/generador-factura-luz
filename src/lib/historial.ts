/**
 * Historial de meses cerrados, persistido en `localStorage`.
 *
 * Todo acceso a `localStorage` esta envuelto en try/catch: en modo incognito
 * (o con storage bloqueado/lleno) el navegador lanza una excepcion en
 * `getItem`/`setItem`, y la app debe seguir funcionando, simplemente sin
 * recordar nada entre sesiones. Este modulo nunca lanza por culpa del
 * storage; en el peor caso, lee vacio y escribe en silencio sin persistir.
 */

import type { EntradaFactura, RegistroMes } from '@/lib/types';

/** Llave bajo la que se guarda el historial completo en `localStorage`. */
const LLAVE_STORAGE = 'factura-luz:historial:v1';

/** Version actual de la forma persistida, para poder migrar en el futuro. */
const VERSION_ACTUAL = 1;

/** Forma que se persiste en `localStorage` bajo `LLAVE_STORAGE`. */
interface HistorialPersistido {
  version: typeof VERSION_ACTUAL;
  registros: RegistroMes[];
}

/**
 * Devuelve el `localStorage` disponible, o `null` si no existe en este
 * entorno (por ejemplo, pruebas en Node sin DOM) o si acceder a el ya lanza.
 *
 * Se resuelve en cada llamada (en vez de cachear el resultado) para que las
 * pruebas puedan inyectar o quitar un doble en `globalThis.localStorage`
 * entre casos.
 */
function storage(): Storage | null {
  try {
    const posible = (globalThis as { localStorage?: Storage }).localStorage;
    return posible ?? null;
  } catch {
    return null;
  }
}

/**
 * Valida que un valor deserializado tenga la forma de `HistorialPersistido`
 * con la version esperada. No valida campo por campo cada `RegistroMes`:
 * confia en que solo este modulo escribe bajo `LLAVE_STORAGE`.
 */
function esHistorialValido(valor: unknown): valor is HistorialPersistido {
  if (valor === null || typeof valor !== 'object') return false;
  const candidato = valor as Partial<HistorialPersistido>;
  return candidato.version === VERSION_ACTUAL && Array.isArray(candidato.registros);
}

/**
 * Lee el historial persistido. Ante cualquier problema (storage ausente,
 * storage que lanza, JSON corrupto, forma inesperada o version distinta a
 * la actual) devuelve una lista vacia en vez de lanzar.
 */
function leerRegistros(): RegistroMes[] {
  try {
    const st = storage();
    if (!st) return [];
    const crudo = st.getItem(LLAVE_STORAGE);
    if (!crudo) return [];
    const parseado: unknown = JSON.parse(crudo);
    if (!esHistorialValido(parseado)) return [];
    return parseado.registros;
  } catch {
    return [];
  }
}

/**
 * Persiste la lista completa de registros. Si el storage no esta
 * disponible o lanza al escribir, falla en silencio: la app sigue
 * funcionando, simplemente no recuerda.
 */
function escribirRegistros(registros: RegistroMes[]): void {
  try {
    const st = storage();
    if (!st) return;
    const historial: HistorialPersistido = { version: VERSION_ACTUAL, registros };
    st.setItem(LLAVE_STORAGE, JSON.stringify(historial));
  } catch {
    // Sin storage disponible (incognito, cuota llena, etc.): no persiste.
  }
}

/**
 * Lista todos los registros guardados, ordenados por `fechaLectura`
 * descendente (el mas reciente primero).
 */
export function listarRegistros(): RegistroMes[] {
  return [...leerRegistros()].sort((a, b) => (a.fechaLectura < b.fechaLectura ? 1 : a.fechaLectura > b.fechaLectura ? -1 : 0));
}

/**
 * Guarda un registro. Si ya existe un registro con el mismo `id`, lo
 * reemplaza en su lugar; si no, lo agrega al final.
 */
export function guardarRegistro(registro: RegistroMes): void {
  const registros = leerRegistros();
  const indice = registros.findIndex((r) => r.id === registro.id);
  if (indice === -1) {
    registros.push(registro);
  } else {
    registros[indice] = registro;
  }
  escribirRegistros(registros);
}

/** Elimina el registro con el `id` dado. No hace nada si no existe. */
export function eliminarRegistro(id: string): void {
  const registros = leerRegistros().filter((r) => r.id !== id);
  escribirRegistros(registros);
}

/**
 * Devuelve el registro con `fechaLectura` mas reciente, o `undefined` si el
 * historial esta vacio.
 */
export function registroMasReciente(): RegistroMes | undefined {
  return listarRegistros()[0];
}

/** Genera un identificador unico, usando `crypto.randomUUID()` cuando esta disponible. */
function generarId(): string {
  try {
    const cripto = (globalThis as { crypto?: Crypto }).crypto;
    if (cripto && typeof cripto.randomUUID === 'function') {
      return cripto.randomUUID();
    }
  } catch {
    // sigue al fallback
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Capitaliza la primera letra de un string. `Intl.DateTimeFormat` con
 * `es-CO` devuelve el nombre del mes en minusculas (ej: "agosto de 2026" o,
 * segun el runtime, "agosto 2026"), y el resto de la UI espera "Agosto 2026".
 */
function capitalizar(texto: string): string {
  if (texto.length === 0) return texto;
  return texto[0].toUpperCase() + texto.slice(1);
}

const FORMATO_MES_ANIO = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });

/**
 * Convierte una fecha `yyyy-mm-dd` en una etiqueta legible tipo "Agosto 2026".
 *
 * Parsea la fecha como fecha LOCAL, no UTC: `new Date('2026-08-17')` se
 * interpreta como medianoche UTC, que en Colombia (UTC-5) cae en el dia
 * anterior y puede desfasar el mes mostrado (por ejemplo, el 1 de un mes se
 * veria como el ultimo dia del mes anterior). Por eso se descomponen los
 * componentes y se construye la fecha con el constructor local de `Date`.
 */
export function etiquetaDeMes(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  return capitalizar(FORMATO_MES_ANIO.format(fecha).replace(' de ', ' '));
}

/**
 * Construye un `RegistroMes` a partir de la entrada digitada por el usuario
 * y el total ya calculado por el motor de calculo.
 *
 * Congela en el registro las tarifas vigentes en `entrada` (ver el TSDoc de
 * `RegistroMes`). Si no se pasa `id`, genera uno nuevo (registro nuevo); si
 * se pasa, se reusa (para editar un registro existente via
 * `guardarRegistro`, que reemplaza por `id`).
 */
export function registroDesdeEntrada(
  entrada: EntradaFactura,
  totalCalculado: number,
  id?: string,
): RegistroMes {
  const consumoKwh =
    entrada.consumoDirecto ?? (entrada.lecturaActual ?? 0) - (entrada.lecturaAnterior ?? 0);

  return {
    id: id ?? generarId(),
    etiqueta: etiquetaDeMes(entrada.fechaLectura),
    fechaInicioCiclo: entrada.fechaInicioCiclo,
    fechaLectura: entrada.fechaLectura,
    diasCiclo: entrada.diasCiclo,
    lecturaAnterior: entrada.lecturaAnterior,
    lecturaActual: entrada.lecturaActual,
    consumoKwh,
    costoUnitarioKwh: entrada.costoUnitarioKwh,
    modoAjuste: entrada.modoAjuste ?? 'porcentaje',
    ajustePorEstratoPct: entrada.ajustePorEstratoPct,
    ajustePorKwh: entrada.ajustePorKwh,
    consumoSubsistenciaKwh: entrada.consumoSubsistenciaKwh,
    alumbradoPublicoPct: entrada.alumbradoPublicoPct,
    valorAseo: entrada.valorAseo,
    totalCalculado,
  };
}
