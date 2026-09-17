/**
 * Pinta un `ResultadoCalculo` (o el estado vacio) en el panel de resultados.
 */

import type { Comparativa, DesgloseFactura, ResultadoCalculo } from '@/lib/types';
import { formatearCOP, formatearKwh, formatearPct } from '@/lib/formato';

function elemento<T extends HTMLElement>(id: string): T {
  const nodo = document.getElementById(id);
  if (!nodo) {
    throw new Error(`No se encontro el elemento #${id} en el panel de resultados.`);
  }
  return nodo as T;
}

/** Prefijo con signo "+" para positivos; formatearCOP/formatearKwh ya ponen el "-". */
function conSigno(valor: number, formateado: string): string {
  return valor > 0 ? `+${formateado}` : formateado;
}

/** Muestra el estado vacio (faltan datos) y oculta el contenido de resultados. */
export function mostrarEstadoVacio(mensaje: string): void {
  elemento('estado-vacio-mensaje').textContent = mensaje;
  elemento('estado-vacio').classList.remove('hidden');
  elemento('resultado-contenido').classList.add('hidden');
}

function pintarDesglose(prefijo: string, desglose: DesgloseFactura): void {
  elemento(`${prefijo}-consumo`).textContent = formatearKwh(desglose.consumoKwh);
  elemento(`${prefijo}-energia`).textContent = formatearCOP(desglose.costoEnergia);
  elemento(`${prefijo}-alumbrado`).textContent = formatearCOP(desglose.alumbradoPublico);
  elemento(`${prefijo}-aseo`).textContent = formatearCOP(desglose.aseo);
  elemento(`${prefijo}-total`).textContent = formatearCOP(desglose.total);

  const filaAjuste = elemento(`${prefijo}-ajuste-fila`);
  const etiquetaAjuste = elemento(`${prefijo}-ajuste-etiqueta`);
  const valorAjuste = elemento(`${prefijo}-ajuste`);

  filaAjuste.classList.remove('text-emerald-600', 'dark:text-emerald-400', 'text-red-600', 'dark:text-red-400');

  if (desglose.ajusteEstrato < 0) {
    etiquetaAjuste.textContent = 'Ahorro por estrato';
    valorAjuste.textContent = `-${formatearCOP(Math.abs(desglose.ajusteEstrato))}`;
    filaAjuste.classList.add('text-emerald-600', 'dark:text-emerald-400');
  } else if (desglose.ajusteEstrato > 0) {
    etiquetaAjuste.textContent = 'Recargo por contribución';
    valorAjuste.textContent = `+${formatearCOP(desglose.ajusteEstrato)}`;
    filaAjuste.classList.add('text-red-600', 'dark:text-red-400');
  } else {
    etiquetaAjuste.textContent = 'Ajuste por estrato';
    valorAjuste.textContent = formatearCOP(0);
  }
}

function pintarComparativa(comparativa: Comparativa | undefined): void {
  const seccion = elemento('comparativa-mes');

  if (!comparativa) {
    seccion.classList.add('hidden');
    return;
  }
  seccion.classList.remove('hidden');

  const flecha = elemento('comparativa-flecha');
  const mensaje = elemento('comparativa-mensaje');

  const magnitudPct = formatearPct(Math.abs(comparativa.deltaValorPct)).replace(/^\+/, '');

  if (comparativa.tendencia === 'exceso') {
    flecha.textContent = '↑';
    flecha.className = 'text-lg leading-none text-red-600 dark:text-red-400';
    mensaje.textContent = `Vas gastando ${magnitudPct} más que el mes pasado.`;
  } else if (comparativa.tendencia === 'ahorro') {
    flecha.textContent = '↓';
    flecha.className = 'text-lg leading-none text-emerald-600 dark:text-emerald-400';
    mensaje.textContent = `Vas gastando ${magnitudPct} menos que el mes pasado.`;
  } else {
    flecha.textContent = '→';
    flecha.className = 'text-lg leading-none text-slate-500 dark:text-slate-400';
    mensaje.textContent = 'Vas gastando prácticamente igual que el mes pasado.';
  }

  elemento('comparativa-delta-kwh').textContent = conSigno(
    comparativa.deltaKwh,
    formatearKwh(comparativa.deltaKwh),
  );
  elemento('comparativa-delta-valor').textContent = conSigno(
    comparativa.deltaValor,
    formatearCOP(comparativa.deltaValor),
  );
  elemento('comparativa-delta-pct').textContent = formatearPct(comparativa.deltaValorPct);
}

/** Pinta el resultado completo y muestra el contenido (oculta el estado vacio). */
export function mostrarResultado(resultado: ResultadoCalculo): void {
  elemento('estado-vacio').classList.add('hidden');
  elemento('resultado-contenido').classList.remove('hidden');

  elemento('total-a-la-fecha').textContent = formatearCOP(resultado.aLaFecha.total);
  elemento('total-proyectado').textContent = formatearCOP(resultado.proyectado.total);

  elemento('dias-transcurridos').textContent = String(resultado.diasTranscurridos);
  elemento('dias-restantes').textContent = String(resultado.diasRestantes);

  const totalDias = resultado.diasTranscurridos + resultado.diasRestantes;
  const progresoPct = totalDias > 0 ? Math.min(100, Math.max(0, (resultado.diasTranscurridos / totalDias) * 100)) : 0;
  elemento('barra-progreso').style.width = `${progresoPct}%`;

  elemento('promedio-diario-kwh').textContent = formatearKwh(resultado.consumoDiarioPromedio);
  const promedioDiarioValor = resultado.diasTranscurridos > 0 ? resultado.aLaFecha.total / resultado.diasTranscurridos : 0;
  elemento('promedio-diario-valor').textContent = formatearCOP(promedioDiarioValor);

  pintarDesglose('proyectado', resultado.proyectado);
  pintarDesglose('a-la-fecha', resultado.aLaFecha);

  pintarComparativa(resultado.comparativa);
}
