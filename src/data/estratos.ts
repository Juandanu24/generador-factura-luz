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
  '2': -37.2864, // medido en un recibo real de Afinia/Monteria: $376,00 de descuento sobre un CU de $1.008,41
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
 * Valores de arranque tomados de un recibo real de Afinia (Caribemar de la
 * Costa) en Monteria, estrato 2 residencial, periodo 16/07/2026 - 17/08/2026.
 *
 * Se usan como referencia porque son datos verificados contra una factura
 * emitida, no estimaciones. El motor de calculo reproduce esa factura al peso
 * (ver `__tests__/recibo-real.test.ts`). Aun asi, el usuario deberia
 * sobrescribirlos con los de SU recibo: el CU cambia todos los meses y el
 * porcentaje de alumbrado publico lo fija cada municipio.
 */
export const RECIBO_REFERENCIA = {
  /** Costo unitario de la energia en $/kWh (renglon "CU" del recibo). */
  costoUnitarioKwh: 1008.41,
  /**
   * El recibo expresa el subsidio como un descuento absoluto de $376,00 por
   * kWh sobre los primeros 173 kWh, no como un porcentaje. Equivale a
   * -37,2864% del CU (376 / 1008,41). Al cambiar el CU el porcentaje deja de
   * corresponder, asi que conviene recalcularlo desde el recibo del mes.
   */
  subsidioPorKwh: 376.0,
  ajustePorEstratoPct: -37.2864,
  /** Monteria esta por debajo de los 1000 m.s.n.m., de ahi el tope de 173. */
  consumoSubsistenciaKwh: SUBSISTENCIA_ALTITUD_BAJA,
  /**
   * 13% exacto del costo de energia ($121.719,41 sobre $936.303,13). El 15%
   * que se suele citar no aplica en este municipio.
   */
  alumbradoPublicoPct: 13,
  /** Valor total del servicio de aseo facturado por Urbaser. */
  valorAseo: 39490,
  /** El ciclo facturado fue de 32 dias, no de 30. */
  diasCiclo: 32,
  /** Estrato del predio. */
  estrato: 2 as Estrato,
} as const;

/**
 * Entrada de arranque del formulario, precargada con los valores del recibo
 * de referencia para no partir de un formulario en blanco.
 */
export function entradaPorDefecto(hoy: Date = new Date()): EntradaFactura {
  const primerDiaDelMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  return {
    fechaInicioCiclo: aFechaLocalISO(primerDiaDelMes),
    fechaLectura: aFechaLocalISO(hoy),
    diasCiclo: RECIBO_REFERENCIA.diasCiclo,
    estrato: RECIBO_REFERENCIA.estrato,
    costoUnitarioKwh: RECIBO_REFERENCIA.costoUnitarioKwh,
    ajustePorEstratoPct: RECIBO_REFERENCIA.ajustePorEstratoPct,
    // Por defecto se usa el descuento en $/kWh, que es como lo publica el
    // recibo y no se desactualiza cuando cambia la tarifa (issue #17).
    modoAjuste: 'pesosPorKwh',
    ajustePorKwh: -RECIBO_REFERENCIA.subsidioPorKwh,
    consumoSubsistenciaKwh: RECIBO_REFERENCIA.consumoSubsistenciaKwh,
    alumbradoPublicoPct: RECIBO_REFERENCIA.alumbradoPublicoPct,
    valorAseo: RECIBO_REFERENCIA.valorAseo,
  };
}

/**
 * Convierte un ajuste porcentual a su equivalente en $/kWh para un CU dado.
 *
 * Sirve para que la UI pueda precargar un valor razonable en pesos cuando el
 * usuario cambia de estrato (la tabla `AJUSTE_POR_ESTRATO` esta en porcentaje)
 * o cuando alterna entre los dos modos sin perder lo que llevaba digitado.
 */
export function pctAPesosPorKwh(pct: number, costoUnitarioKwh: number): number {
  return costoUnitarioKwh * (pct / 100);
}

/**
 * Convierte un ajuste en $/kWh a su equivalente porcentual para un CU dado.
 * Devuelve 0 si el CU no es utilizable, para no producir Infinity ni NaN.
 */
export function pesosPorKwhAPct(pesosPorKwh: number, costoUnitarioKwh: number): number {
  if (!costoUnitarioKwh) return 0;
  return (pesosPorKwh / costoUnitarioKwh) * 100;
}
