/**
 * Comparativa del consumo/valor proyectado frente al mes anterior.
 */

import type { Comparativa, DesgloseFactura } from '@/lib/types';

/** Banda muerta (en %) dentro de la cual la tendencia se considera 'igual'. */
const BANDA_MUERTA_PCT = 2;

/** Variacion porcentual protegida contra division por cero. */
function pctSeguro(delta: number, base: number): number {
  if (base === 0) {
    return delta === 0 ? 0 : 100;
  }
  return (delta / base) * 100;
}

/**
 * Compara el consumo/valor PROYECTADO al cierre del ciclo contra el mes
 * anterior. Devuelve `undefined` si no hay datos del mes anterior (comparar
 * unos pocos dias contra un mes completo no dice nada).
 */
export function compararConMesAnterior(
  proyectado: DesgloseFactura,
  consumoMesAnteriorKwh?: number,
  valorMesAnterior?: number,
): Comparativa | undefined {
  if (consumoMesAnteriorKwh === undefined || valorMesAnterior === undefined) {
    return undefined;
  }

  const deltaKwh = proyectado.consumoKwh - consumoMesAnteriorKwh;
  const deltaPct = pctSeguro(deltaKwh, consumoMesAnteriorKwh);

  const deltaValor = proyectado.total - valorMesAnterior;
  const deltaValorPct = pctSeguro(deltaValor, valorMesAnterior);

  let tendencia: Comparativa['tendencia'];
  if (deltaPct > BANDA_MUERTA_PCT) {
    tendencia = 'exceso';
  } else if (deltaPct < -BANDA_MUERTA_PCT) {
    tendencia = 'ahorro';
  } else {
    tendencia = 'igual';
  }

  return { deltaKwh, deltaPct, deltaValor, deltaValorPct, tendencia };
}
