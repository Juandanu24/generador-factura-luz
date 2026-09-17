/**
 * Datos de referencia para estratos socioeconomicos colombianos y valores
 * por defecto del formulario.
 */

import type { EntradaFactura, Estrato } from '@/lib/types';

/**
 * Ajuste porcentual sugerido sobre el costo unitario segun el estrato.
 *
 * Estos son valores TIPICOS/APROXIMADOS de referencia (varian por operador de
 * red, municipio y periodo regulatorio). El usuario deberia sobrescribirlos
 * con lo que diga su propio recibo de energia.
 */
export const AJUSTE_POR_ESTRATO: Record<string, number> = {
  '1': -60, // subsidio tipico estrato 1 (maximo subsidio)
  '2': -50, // subsidio tipico estrato 2
  '3': -15, // subsidio tipico estrato 3
  '4': 0, // estrato 4: tarifa plena, sin subsidio ni contribucion
  '5': 20, // contribucion tipica estrato 5
  '6': 20, // contribucion tipica estrato 6
  comercial: 20, // contribucion tipica uso comercial/industrial
};

/** Opciones de estrato para poblar un select en la UI, en orden de despliegue. */
export const OPCIONES_ESTRATO: ReadonlyArray<{ valor: Estrato; etiqueta: string }> = [
  { valor: 1, etiqueta: 'Estrato 1' },
  { valor: 2, etiqueta: 'Estrato 2' },
  { valor: 3, etiqueta: 'Estrato 3' },
  { valor: 4, etiqueta: 'Estrato 4' },
  { valor: 5, etiqueta: 'Estrato 5' },
  { valor: 6, etiqueta: 'Estrato 6' },
  { valor: 'comercial', etiqueta: 'Comercial' },
];

/** Tope de consumo de subsistencia (kWh/mes) para municipios a >= 1000 m.s.n.m. */
export const SUBSISTENCIA_ALTITUD_ALTA = 130;

/** Tope de consumo de subsistencia (kWh/mes) para municipios a < 1000 m.s.n.m. */
export const SUBSISTENCIA_ALTITUD_BAJA = 173;

/** Formatea una fecha como `yyyy-mm-dd` usando sus componentes LOCALES (no UTC). */
function aFechaLocalISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * Entrada de ejemplo lista para usar, con valores de arranque razonables
 * para un estrato 3 tipico en Colombia.
 */
export function entradaPorDefecto(hoy: Date = new Date()): EntradaFactura {
  const primerDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  return {
    fechaInicioCiclo: aFechaLocalISO(primerDiaDelMes),
    fechaLectura: aFechaLocalISO(hoy),
    diasCiclo: 30,
    estrato: 3,
    costoUnitarioKwh: 900,
    ajustePorEstratoPct: -15,
    consumoSubsistenciaKwh: 173,
    alumbradoPublicoPct: 15,
    valorAseo: 40000,
  };
}
