/**
 * Formateo de numeros para mostrar al usuario final, en es-CO.
 *
 * El redondeo a peso entero (y a un decimal para kWh/porcentajes) sucede
 * aqui, nunca en el motor de calculo.
 */

const FORMATO_COP = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

const FORMATO_KWH = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const FORMATO_PCT = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

/**
 * Evita mostrar "-0" (o "-$ 0" / "-0,0") cuando el valor redondea a cero
 * negativo en la precision con la que se va a mostrar.
 */
function sinCeroNegativo(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  const redondeado = Math.round(valor * factor) / factor;
  return redondeado === 0 ? 0 : valor;
}

/** Formatea un valor en pesos colombianos, sin decimales. Ej: "$ 123.456". */
export function formatearCOP(valor: number): string {
  // Intl inserta un espacio de no separacion (U+00A0) entre el simbolo y el
  // numero; lo normalizamos a un espacio comun para un string predecible.
  return FORMATO_COP.format(sinCeroNegativo(valor, 0)).replace(/ /g, ' ');
}

/** Formatea un consumo en kWh con un decimal. Ej: "123,4 kWh". */
export function formatearKwh(valor: number): string {
  return `${FORMATO_KWH.format(sinCeroNegativo(valor, 1))} kWh`;
}

/** Formatea un porcentaje con signo explicito y un decimal. Ej: "+12,5 %" / "-8,0 %". */
export function formatearPct(valor: number): string {
  return `${FORMATO_PCT.format(sinCeroNegativo(valor, 1))} %`;
}
