/**
 * Persistencia de la entrada del formulario en `localStorage`.
 *
 * Toda lectura y escritura va envuelta en try/catch: en modo incognito (o con
 * el storage bloqueado / lleno) `localStorage` puede lanzar excepciones, y la
 * app debe seguir funcionando igual, solo que sin recordar nada entre visitas.
 */

import type { EntradaFactura } from '@/lib/types';
import { entradaPorDefecto } from '@/data/estratos';

const CLAVE_ALMACENAMIENTO = 'factura-luz:v1';
const VERSION_ACTUAL = 1;

interface EntradaAlmacenada {
  version: typeof VERSION_ACTUAL;
  datos: EntradaFactura;
}

/** Guarda la entrada actual. No hace nada (silenciosamente) si localStorage no esta disponible. */
export function guardarEntrada(entrada: EntradaFactura): void {
  try {
    const paquete: EntradaAlmacenada = { version: VERSION_ACTUAL, datos: entrada };
    window.localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(paquete));
  } catch {
    // localStorage no disponible (modo incognito, cuota agotada, etc.):
    // la app sigue funcionando, simplemente no recuerda entre visitas.
  }
}

/** Lee la entrada guardada. Devuelve `null` si no hay nada, si esta corrupta o si el storage falla. */
export function cargarEntrada(): EntradaFactura | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_ALMACENAMIENTO);
    if (!crudo) return null;

    const paquete = JSON.parse(crudo) as Partial<EntradaAlmacenada> | null;
    if (!paquete || paquete.version !== VERSION_ACTUAL || !paquete.datos) return null;

    return paquete.datos;
  } catch {
    return null;
  }
}

/** Borra lo guardado y devuelve una entrada nueva con los valores por defecto. */
export function limpiarEntrada(): EntradaFactura {
  try {
    window.localStorage.removeItem(CLAVE_ALMACENAMIENTO);
  } catch {
    // Si localStorage no esta disponible tampoco habia nada que borrar.
  }
  return entradaPorDefecto();
}
