/**
 * Proyeccion del consumo y del valor de la factura al cierre del ciclo de
 * facturacion, a partir de lo consumido hasta la fecha de lectura.
 */

import { calcularConsumo, calcularFactura } from '@/lib/calculo';
import { compararConMesAnterior } from '@/lib/comparativa';
import type { EntradaFactura, ResultadoCalculo } from '@/lib/types';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Parsea una fecha `yyyy-mm-dd` como fecha LOCAL (no UTC). */
function parsearFechaLocal(iso: string): Date {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(anio, (mes ?? 1) - 1, dia ?? 1);
}

/**
 * Numero de dias corridos entre dos fechas `yyyy-mm-dd`, interpretadas como
 * fechas locales para evitar el desfase de UTC.
 */
export function diasEntre(desdeISO: string, hastaISO: string): number {
  const desde = parsearFechaLocal(desdeISO);
  const hasta = parsearFechaLocal(hastaISO);
  return Math.round((hasta.getTime() - desde.getTime()) / MS_POR_DIA);
}

/**
 * Calcula el desglose a la fecha y la proyeccion al cierre del ciclo,
 * junto con la comparativa contra el mes anterior cuando hay datos.
 */
export function proyectar(entrada: EntradaFactura): ResultadoCalculo {
  const consumoALaFecha = calcularConsumo(entrada);
  const aLaFecha = calcularFactura(entrada, consumoALaFecha);

  const diasTranscurridos = Math.max(1, diasEntre(entrada.fechaInicioCiclo, entrada.fechaLectura));
  const diasRestantes = Math.max(0, entrada.diasCiclo - diasTranscurridos);
  const consumoDiarioPromedio = consumoALaFecha / diasTranscurridos;

  let proyectado = aLaFecha;
  if (diasTranscurridos < entrada.diasCiclo) {
    const consumoProyectado = consumoDiarioPromedio * entrada.diasCiclo;
    // El tope de subsistencia es mensual: se compara contra el consumo
    // proyectado completo, no contra el consumo parcial a la fecha.
    proyectado = calcularFactura(entrada, consumoProyectado);
  }

  const comparativa = compararConMesAnterior(
    proyectado,
    entrada.consumoMesAnteriorKwh,
    entrada.valorMesAnterior,
  );

  return {
    aLaFecha,
    proyectado,
    diasTranscurridos,
    diasRestantes,
    consumoDiarioPromedio,
    comparativa,
  };
}
