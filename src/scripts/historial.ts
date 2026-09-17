/**
 * Cableado de la sección "Historial de meses": pinta la lista guardada,
 * guarda el mes actual, permite corregir el total facturado, eliminar un
 * registro (con confirmación) y usar un registro guardado como punto de
 * partida (lectura anterior) del ciclo nuevo.
 *
 * Toda la lógica de cálculo y persistencia vive en `@/lib/historial`; este
 * módulo solo lee el DOM, arma nodos y llama a esas funciones.
 */

import type { EntradaFactura, RegistroMes, ResultadoCalculo } from '@/lib/types';
import {
  eliminarRegistro,
  guardarRegistro,
  listarRegistros,
  registroDesdeEntrada,
  registroMasReciente,
} from '@/lib/historial';
import { formatearCOP, formatearKwh } from '@/lib/formato';

/**
 * Porcentaje "plano", sin el signo forzado de `formatearPct`: la diferencia
 * entre estimado y facturado no es un subsidio/contribución, así que el
 * signo no aporta (se explica en el propio texto con "más"/"menos").
 */
const FORMATO_PCT_PLANO = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function formatearPctPlano(valor: number): string {
  return `${FORMATO_PCT_PLANO.format(valor)} %`;
}

function elemento<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/** Última entrada válida y su resultado, para que "Guardar este mes" no tenga que recalcular nada. */
let entradaValidaActual: EntradaFactura | undefined;
let resultadoActual: ResultadoCalculo | undefined;

/**
 * Comprueba si `localStorage` esta realmente disponible y utilizable ahora
 * mismo (no solo si existe: en incognito puede existir y aun asi lanzar al
 * escribir). Solo para decidir si mostramos el aviso de "no se va a
 * recordar"; `@/lib/historial` ya tolera su ausencia por su cuenta.
 */
function localStorageDisponible(): boolean {
  try {
    const clave = '__factura-luz-historial-test__';
    window.localStorage.setItem(clave, '1');
    window.localStorage.removeItem(clave);
    return true;
  } catch {
    return false;
  }
}

function claseSegunMagnitud(diferenciaPct: number): string {
  const magnitud = Math.abs(diferenciaPct);
  if (magnitud <= 3) return 'text-emerald-600 dark:text-emerald-400';
  if (magnitud <= 10) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Construye el mensaje de "qué tan cerca estuvo la estimación" (el valor más
 * util de esta sección: es lo único que le dice al usuario si puede confiar
 * en la app). Ej: "Estimé $680.682, llegó $692.100 — 1,7 % de diferencia
 * (más de lo estimado)."
 */
function mensajeDiferencia(totalCalculado: number, totalFacturado: number): { texto: string; clase: string } {
  const diferenciaAbs = totalFacturado - totalCalculado;
  const diferenciaPct = totalCalculado !== 0 ? (diferenciaAbs / totalCalculado) * 100 : 0;

  if (Math.round(diferenciaAbs) === 0) {
    return {
      texto: `Estimé ${formatearCOP(totalCalculado)} y quedó exacto con lo facturado.`,
      clase: 'text-emerald-600 dark:text-emerald-400',
    };
  }

  const calificador = diferenciaAbs > 0 ? 'más' : 'menos';
  return {
    texto: `Estimé ${formatearCOP(totalCalculado)}, llegó ${formatearCOP(totalFacturado)} — ${formatearPctPlano(Math.abs(diferenciaPct))} de diferencia (${calificador} de lo estimado).`,
    clase: claseSegunMagnitud(diferenciaPct),
  };
}

function crearDato(etiqueta: string, valor: string): HTMLDivElement {
  const contenedor = document.createElement('div');
  contenedor.className = 'min-w-0';

  const dt = document.createElement('dt');
  dt.className = 'text-xs text-slate-500 dark:text-slate-400';
  dt.textContent = etiqueta;

  const dd = document.createElement('dd');
  dd.className = 'break-words font-medium text-slate-800 dark:text-slate-100';
  dd.textContent = valor;

  contenedor.appendChild(dt);
  contenedor.appendChild(dd);
  return contenedor;
}

function crearFilaRegistro(registro: RegistroMes): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'seccion-tarjeta';
  li.dataset.id = registro.id;

  const encabezado = document.createElement('div');
  encabezado.className = 'flex items-start justify-between gap-2';

  const titulo = document.createElement('p');
  titulo.className = 'min-w-0 break-words font-semibold text-slate-900 dark:text-slate-100';
  titulo.textContent = registro.etiqueta;
  encabezado.appendChild(titulo);

  const botonEliminar = document.createElement('button');
  botonEliminar.type = 'button';
  botonEliminar.dataset.accion = 'eliminar';
  botonEliminar.setAttribute('aria-label', `Eliminar ${registro.etiqueta} del historial`);
  botonEliminar.className =
    'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400';
  botonEliminar.textContent = '✕';
  encabezado.appendChild(botonEliminar);

  li.appendChild(encabezado);

  const datos = document.createElement('dl');
  datos.className = 'mt-2 grid grid-cols-2 gap-2 text-sm';
  datos.appendChild(crearDato('Consumo', formatearKwh(registro.consumoKwh)));
  datos.appendChild(crearDato('Estimado', formatearCOP(registro.totalCalculado)));
  li.appendChild(datos);

  // Total facturado real: siempre editable, prellenado si ya se digitó antes.
  const bloqueFacturado = document.createElement('div');
  bloqueFacturado.className = 'mt-3';

  const idInput = `facturado-${registro.id}`;

  const etiquetaFacturado = document.createElement('label');
  etiquetaFacturado.className = 'etiqueta-campo';
  etiquetaFacturado.setAttribute('for', idInput);
  etiquetaFacturado.textContent = 'Total facturado real ($)';
  bloqueFacturado.appendChild(etiquetaFacturado);

  const filaInput = document.createElement('div');
  filaInput.className = 'flex items-center gap-2';

  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'decimal';
  input.step = 'any';
  input.min = '0';
  input.id = idInput;
  input.dataset.accion = 'campo-facturado';
  input.className = 'campo-entrada min-w-0 flex-1';
  input.placeholder = 'Cuando llegue el recibo';
  if (registro.totalFacturado !== undefined) {
    input.value = String(registro.totalFacturado);
  }
  filaInput.appendChild(input);

  const botonGuardarFacturado = document.createElement('button');
  botonGuardarFacturado.type = 'button';
  botonGuardarFacturado.dataset.accion = 'guardar-facturado';
  botonGuardarFacturado.className = 'boton-secundario shrink-0';
  botonGuardarFacturado.textContent = 'Guardar';
  filaInput.appendChild(botonGuardarFacturado);

  bloqueFacturado.appendChild(filaInput);
  li.appendChild(bloqueFacturado);

  if (registro.totalFacturado !== undefined) {
    const { texto, clase } = mensajeDiferencia(registro.totalCalculado, registro.totalFacturado);
    const mensaje = document.createElement('p');
    mensaje.className = `mt-2 text-xs font-medium leading-snug ${clase}`;
    mensaje.textContent = texto;
    li.appendChild(mensaje);
  }

  // Sin lectura numérica (se guardó con consumo directo) no hay de dónde encadenar el ciclo nuevo.
  if (registro.lecturaActual !== undefined) {
    const botonUsar = document.createElement('button');
    botonUsar.type = 'button';
    botonUsar.dataset.accion = 'usar';
    botonUsar.className = 'boton-secundario mt-3 w-full';
    botonUsar.textContent = 'Usar como lectura anterior del nuevo ciclo';
    li.appendChild(botonUsar);
  }

  return li;
}

/** Repinta toda la lista (o el estado vacío) a partir de lo que hay en `localStorage`. */
export function renderizarHistorial(): void {
  const lista = elemento<HTMLUListElement>('historial-lista');
  const vacio = elemento<HTMLDivElement>('historial-vacio');
  if (!lista || !vacio) return;

  const registros = listarRegistros();
  lista.innerHTML = '';

  if (registros.length === 0) {
    vacio.classList.remove('hidden');
    lista.classList.add('hidden');
    return;
  }

  vacio.classList.add('hidden');
  lista.classList.remove('hidden');

  for (const registro of registros) {
    lista.appendChild(crearFilaRegistro(registro));
  }
}

function mostrarMensajeTemporal(id: string, ms = 4000): void {
  const nodo = elemento<HTMLElement>(id);
  if (!nodo) return;
  nodo.classList.remove('hidden');
  window.setTimeout(() => nodo.classList.add('hidden'), ms);
}

/**
 * Precarga en el formulario la lectura anterior y la fecha de inicio del
 * ciclo nuevo a partir de un registro guardado (issue #23: "el ciclo nuevo
 * arranca donde terminó el anterior"). Limpia la lectura de hoy, porque el
 * valor que había ahí pertenecía al ciclo cerrado y dejarlo puesto haría que
 * el consumo del ciclo nuevo arrancara en 0 kWh. Dispara los eventos que ya
 * escucha `app.ts` para que el recálculo en vivo se dispare solo.
 */
export function precargarLecturaAnterior(registro: RegistroMes): boolean {
  if (registro.lecturaActual === undefined) return false;

  const radioLecturas = elemento<HTMLInputElement>('modo-lecturas');
  const campoLecturaAnterior = elemento<HTMLInputElement>('lecturaAnterior');
  const campoLecturaActual = elemento<HTMLInputElement>('lecturaActual');
  const campoFechaInicio = elemento<HTMLInputElement>('fechaInicioCiclo');
  if (!campoLecturaAnterior || !campoFechaInicio) return false;

  if (radioLecturas && !radioLecturas.checked) {
    radioLecturas.checked = true;
    radioLecturas.dispatchEvent(new Event('change', { bubbles: true }));
  }

  campoLecturaAnterior.value = String(registro.lecturaActual);
  campoFechaInicio.value = registro.fechaLectura;
  if (campoLecturaActual) campoLecturaActual.value = '';

  campoLecturaAnterior.dispatchEvent(new Event('input', { bubbles: true }));
  campoFechaInicio.dispatchEvent(new Event('input', { bubbles: true }));
  campoLecturaActual?.dispatchEvent(new Event('input', { bubbles: true }));

  mostrarMensajeTemporal('historial-usado-mensaje');
  return true;
}

/** Si el formulario aún no tiene lecturas y hay historial, ofrece el registro más reciente por defecto. */
function ofrecerLecturaAnteriorPorDefecto(): void {
  const campoLecturaAnterior = elemento<HTMLInputElement>('lecturaAnterior');
  const campoLecturaActual = elemento<HTMLInputElement>('lecturaActual');
  if (!campoLecturaAnterior || !campoLecturaActual) return;

  const formularioVacio = campoLecturaAnterior.value.trim() === '' && campoLecturaActual.value.trim() === '';
  if (!formularioVacio) return;

  const ultimo = registroMasReciente();
  if (!ultimo) return;

  precargarLecturaAnterior(ultimo);
}

function guardarMesActual(): void {
  if (!entradaValidaActual || !resultadoActual) return;
  const registro = registroDesdeEntrada(entradaValidaActual, resultadoActual.proyectado.total);
  guardarRegistro(registro);
  renderizarHistorial();
  mostrarMensajeTemporal('historial-guardado-mensaje');
}

function manejarClicLista(evento: Event): void {
  const objetivo = evento.target;
  if (!(objetivo instanceof HTMLElement)) return;

  const boton = objetivo.closest<HTMLElement>('[data-accion]');
  if (!boton) return;

  const fila = boton.closest<HTMLElement>('li[data-id]');
  const id = fila?.dataset.id;
  if (!id) return;

  const accion = boton.dataset.accion;

  if (accion === 'eliminar') {
    const registro = listarRegistros().find((r) => r.id === id);
    const etiqueta = registro?.etiqueta ?? 'este mes';
    const confirmado = window.confirm(`¿Eliminar ${etiqueta} del historial? Esta acción no se puede deshacer.`);
    if (!confirmado) return;

    eliminarRegistro(id);
    renderizarHistorial();
    return;
  }

  if (accion === 'guardar-facturado') {
    const input = fila?.querySelector<HTMLInputElement>('[data-accion="campo-facturado"]');
    const registro = listarRegistros().find((r) => r.id === id);
    if (!input || !registro) return;

    const texto = input.value.trim();

    if (texto === '') {
      // Campo vaciado a propósito: se borra el total facturado, no se pone en 0.
      const actualizado: RegistroMes = { ...registro };
      delete actualizado.totalFacturado;
      guardarRegistro(actualizado);
      renderizarHistorial();
      return;
    }

    const valor = Number(texto);
    if (!Number.isFinite(valor) || valor < 0) return;

    guardarRegistro({ ...registro, totalFacturado: valor });
    renderizarHistorial();
    return;
  }

  if (accion === 'usar') {
    const registro = listarRegistros().find((r) => r.id === id);
    if (registro) precargarLecturaAnterior(registro);
  }
}

/**
 * Actualiza el estado guardado en memoria con la última entrada/resultado
 * validos, y habilita o deshabilita "Guardar este mes" segun corresponda.
 * La llama `app.ts` en cada recalculo (valido o no).
 */
export function actualizarEstadoGuardado(entrada: EntradaFactura, resultado: ResultadoCalculo | undefined): void {
  entradaValidaActual = resultado ? entrada : undefined;
  resultadoActual = resultado;

  const boton = elemento<HTMLButtonElement>('btn-guardar-mes');
  if (boton) boton.disabled = !resultado;
}

/** Cablea la sección de historial: pinta la lista, los botones y ofrece la última lectura por defecto. */
export function inicializarHistorial(): void {
  const aviso = elemento<HTMLElement>('historial-aviso-storage');
  if (aviso && !localStorageDisponible()) {
    aviso.classList.remove('hidden');
  }

  renderizarHistorial();

  elemento<HTMLUListElement>('historial-lista')?.addEventListener('click', manejarClicLista);
  elemento<HTMLButtonElement>('btn-guardar-mes')?.addEventListener('click', guardarMesActual);

  ofrecerLecturaAnteriorPorDefecto();
}
