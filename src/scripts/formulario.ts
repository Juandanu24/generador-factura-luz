/**
 * Lectura y escritura del formulario de consumo: convierte entre el DOM y
 * `EntradaFactura`, y pinta los errores de validacion junto a cada campo.
 */

import type { EntradaFactura, ErrorValidacion, Estrato, ModoAjuste } from '@/lib/types';
import { pctAPesosPorKwh, pesosPorKwhAPct } from '@/data/estratos';

type ModoConsumo = 'lecturas' | 'directo';

function elemento<T extends HTMLElement>(id: string): T {
  const nodo = document.getElementById(id);
  if (!nodo) {
    throw new Error(`No se encontro el elemento #${id} en el formulario.`);
  }
  return nodo as T;
}

/** Numero requerido: NaN si el campo esta vacio o no es numero (lo detecta validarEntrada/erroresDeCamposVacios). */
function numeroRequerido(id: string): number {
  const valor = elemento<HTMLInputElement>(id).value;
  return valor.trim() === '' ? NaN : Number(valor);
}

/** Numero opcional: undefined si el campo esta vacio. */
function numeroOpcional(id: string): number | undefined {
  const valor = elemento<HTMLInputElement>(id).value;
  return valor.trim() === '' ? undefined : Number(valor);
}

function textoRequerido(id: string): string {
  return elemento<HTMLInputElement>(id).value;
}

function modoConsumoActual(): ModoConsumo {
  return elemento<HTMLInputElement>('modo-directo').checked ? 'directo' : 'lecturas';
}

/** Modo en que el usuario esta expresando el ajuste por estrato ahora mismo, segun el toggle. */
export function modoAjusteActual(): ModoAjuste {
  return elemento<HTMLInputElement>('modo-ajuste-porcentaje').checked ? 'porcentaje' : 'pesosPorKwh';
}

function estratoDesdeValor(valor: string): Estrato {
  return valor === 'comercial' ? 'comercial' : (Number(valor) as Estrato);
}

/** Muestra u oculta el bloque de lecturas / consumo directo segun el modo elegido. */
export function actualizarVisibilidadModoConsumo(): void {
  const modo = modoConsumoActual();
  elemento('bloque-lecturas').classList.toggle('hidden', modo !== 'lecturas');
  elemento('bloque-directo').classList.toggle('hidden', modo !== 'directo');
}

/** Muestra u oculta el bloque $/kWh / porcentaje del ajuste por estrato segun el modo elegido. */
export function actualizarVisibilidadModoAjuste(): void {
  const modo = modoAjusteActual();
  elemento('bloque-ajuste-pesos').classList.toggle('hidden', modo !== 'pesosPorKwh');
  elemento('bloque-ajuste-porcentaje').classList.toggle('hidden', modo !== 'porcentaje');
}

/**
 * Mantiene sincronizados los campos `ajustePorKwh` y `ajustePorEstratoPct`
 * entre si, usando el que esta a la vista (segun el modo activo) como fuente
 * de verdad y convirtiendo el otro con el costo unitario en pantalla.
 *
 * Asi el usuario no pierde lo digitado al alternar de modo, y el campo
 * escondido nunca queda en NaN ni desactualizado (lo que dispararia un error
 * de `validarEntrada` para un campo que ni siquiera puede ver).
 *
 * No hace nada si el costo unitario en pantalla no es un numero utilizable:
 * en ese caso se deja el campo escondido tal como estaba.
 */
export function sincronizarCampoAjusteInactivo(): void {
  const cu = Number(elemento<HTMLInputElement>('costoUnitarioKwh').value);
  if (!Number.isFinite(cu) || cu <= 0) return;

  const modo = modoAjusteActual();
  const campoPesos = elemento<HTMLInputElement>('ajustePorKwh');
  const campoPct = elemento<HTMLInputElement>('ajustePorEstratoPct');

  if (modo === 'pesosPorKwh') {
    const pesos = campoPesos.value.trim() === '' ? NaN : Number(campoPesos.value);
    if (!Number.isFinite(pesos)) return;
    // Se mantiene el campo oculto en sincronia para que alternar de modo no
    // pierda lo digitado. No hace falta acotarlo: en modo `pesosPorKwh` el
    // motor ignora este campo y `validarEntrada` ya no le exige rango.
    campoPct.value = String(pesosPorKwhAPct(pesos, cu));
  } else {
    const pct = campoPct.value.trim() === '' ? NaN : Number(campoPct.value);
    if (!Number.isFinite(pct)) return;
    campoPesos.value = String(pctAPesosPorKwh(pct, cu));
  }
}

/** Lee todo el formulario y arma una `EntradaFactura`. Los campos vacios quedan en NaN/undefined. */
export function leerEntradaDelFormulario(): EntradaFactura {
  const modo = modoConsumoActual();

  return {
    lecturaAnterior: modo === 'lecturas' ? numeroOpcional('lecturaAnterior') : undefined,
    lecturaActual: modo === 'lecturas' ? numeroOpcional('lecturaActual') : undefined,
    consumoDirecto: modo === 'directo' ? numeroOpcional('consumoDirecto') : undefined,
    fechaInicioCiclo: textoRequerido('fechaInicioCiclo'),
    fechaLectura: textoRequerido('fechaLectura'),
    diasCiclo: numeroRequerido('diasCiclo'),
    estrato: estratoDesdeValor(elemento<HTMLSelectElement>('estrato').value),
    costoUnitarioKwh: numeroRequerido('costoUnitarioKwh'),
    ajustePorEstratoPct: numeroRequerido('ajustePorEstratoPct'),
    modoAjuste: modoAjusteActual(),
    ajustePorKwh: numeroOpcional('ajustePorKwh'),
    consumoSubsistenciaKwh: numeroRequerido('consumoSubsistenciaKwh'),
    alumbradoPublicoPct: numeroRequerido('alumbradoPublicoPct'),
    valorAseo: numeroRequerido('valorAseo'),
    consumoMesAnteriorKwh: numeroOpcional('consumoMesAnteriorKwh'),
    valorMesAnterior: numeroOpcional('valorMesAnterior'),
  };
}

/** Rehidrata el formulario con una entrada guardada o por defecto. */
export function escribirEntradaEnFormulario(entrada: EntradaFactura): void {
  const modo: ModoConsumo = entrada.consumoDirecto !== undefined ? 'directo' : 'lecturas';
  elemento<HTMLInputElement>(modo === 'directo' ? 'modo-directo' : 'modo-lecturas').checked = true;

  elemento<HTMLInputElement>('lecturaAnterior').value = entrada.lecturaAnterior?.toString() ?? '';
  elemento<HTMLInputElement>('lecturaActual').value = entrada.lecturaActual?.toString() ?? '';
  elemento<HTMLInputElement>('consumoDirecto').value = entrada.consumoDirecto?.toString() ?? '';
  elemento<HTMLInputElement>('fechaInicioCiclo').value = entrada.fechaInicioCiclo ?? '';
  elemento<HTMLInputElement>('fechaLectura').value = entrada.fechaLectura ?? '';
  elemento<HTMLInputElement>('diasCiclo').value = Number.isFinite(entrada.diasCiclo)
    ? String(entrada.diasCiclo)
    : '';
  elemento<HTMLSelectElement>('estrato').value = String(entrada.estrato ?? 3);
  elemento<HTMLInputElement>('costoUnitarioKwh').value = Number.isFinite(entrada.costoUnitarioKwh)
    ? String(entrada.costoUnitarioKwh)
    : '';
  elemento<HTMLInputElement>('ajustePorEstratoPct').value = Number.isFinite(entrada.ajustePorEstratoPct)
    ? String(entrada.ajustePorEstratoPct)
    : '';
  const modoAjuste: ModoAjuste = entrada.modoAjuste ?? 'porcentaje';
  elemento<HTMLInputElement>(modoAjuste === 'pesosPorKwh' ? 'modo-ajuste-pesos' : 'modo-ajuste-porcentaje').checked =
    true;
  elemento<HTMLInputElement>('ajustePorKwh').value = entrada.ajustePorKwh?.toString() ?? '';
  elemento<HTMLInputElement>('consumoSubsistenciaKwh').value = Number.isFinite(entrada.consumoSubsistenciaKwh)
    ? String(entrada.consumoSubsistenciaKwh)
    : '';
  elemento<HTMLInputElement>('alumbradoPublicoPct').value = Number.isFinite(entrada.alumbradoPublicoPct)
    ? String(entrada.alumbradoPublicoPct)
    : '';
  elemento<HTMLInputElement>('valorAseo').value = Number.isFinite(entrada.valorAseo) ? String(entrada.valorAseo) : '';
  elemento<HTMLInputElement>('consumoMesAnteriorKwh').value = entrada.consumoMesAnteriorKwh?.toString() ?? '';
  elemento<HTMLInputElement>('valorMesAnterior').value = entrada.valorMesAnterior?.toString() ?? '';

  actualizarVisibilidadModoConsumo();
  actualizarVisibilidadModoAjuste();
  actualizarAtajosSubsistencia();
}

/** Resalta el atajo (130/173) que coincide con el valor actual del campo, si alguno coincide. */
export function actualizarAtajosSubsistencia(): void {
  const valor = elemento<HTMLInputElement>('consumoSubsistenciaKwh').value;
  elemento<HTMLButtonElement>('btn-subsistencia-alta').setAttribute('aria-pressed', String(valor === '130'));
  elemento<HTMLButtonElement>('btn-subsistencia-baja').setAttribute('aria-pressed', String(valor === '173'));
}

/**
 * Validaciones propias de la UI para campos numericos obligatorios vacios.
 * `validarEntrada` (en `src/lib/calculo.ts`) no siempre detecta NaN en todos
 * los campos requeridos, asi que esto garantiza que nunca se llegue a
 * calcular con un campo obligatorio vacio.
 */
export function erroresDeCamposVacios(entrada: EntradaFactura): ErrorValidacion[] {
  const errores: ErrorValidacion[] = [];

  const numericosRequeridos: Array<{ campo: keyof EntradaFactura; mensaje: string }> = [
    { campo: 'costoUnitarioKwh', mensaje: 'Ingresa el costo unitario del kWh.' },
    { campo: 'diasCiclo', mensaje: 'Ingresa la duracion del ciclo en dias.' },
    { campo: 'consumoSubsistenciaKwh', mensaje: 'Ingresa el tope de consumo de subsistencia.' },
    { campo: 'alumbradoPublicoPct', mensaje: 'Ingresa el porcentaje de alumbrado publico.' },
    { campo: 'valorAseo', mensaje: 'Ingresa el valor del aseo.' },
  ];

  // El campo de porcentaje solo es responsabilidad directa del usuario cuando
  // ese es el modo activo; en modo $/kWh queda oculto y sincronizado, y
  // `validarEntrada` ya cubre el campo `ajustePorKwh` vacio con su propio
  // mensaje.
  if (entrada.modoAjuste !== 'pesosPorKwh') {
    numericosRequeridos.push({ campo: 'ajustePorEstratoPct', mensaje: 'Ingresa el ajuste por estrato.' });
  }

  for (const { campo, mensaje } of numericosRequeridos) {
    const valor = entrada[campo];
    if (typeof valor === 'number' && Number.isNaN(valor)) {
      errores.push({ campo, mensaje });
    }
  }

  if (!entrada.fechaInicioCiclo) {
    errores.push({ campo: 'fechaInicioCiclo', mensaje: 'Ingresa la fecha de inicio del ciclo.' });
  }
  if (!entrada.fechaLectura) {
    errores.push({ campo: 'fechaLectura', mensaje: 'Ingresa la fecha de la lectura de hoy.' });
  }

  return errores;
}

/** Limpia todos los mensajes de error y los estilos de campo invalido. */
export function limpiarErrores(): void {
  document.querySelectorAll<HTMLElement>('[data-error-for]').forEach((nodo) => {
    nodo.textContent = '';
    nodo.classList.add('hidden');
  });
  document.querySelectorAll<HTMLElement>('[data-campo]').forEach((campo) => {
    campo.removeAttribute('aria-invalid');
  });
}

/** Pinta la lista de errores de validacion junto a cada campo (o en el banner general). */
export function mostrarErrores(errores: ErrorValidacion[]): void {
  limpiarErrores();

  const mensajesGenerales: string[] = [];

  for (const error of errores) {
    if (error.campo === 'general') {
      mensajesGenerales.push(error.mensaje);
      continue;
    }

    const nodoError = document.querySelector<HTMLElement>(`[data-error-for="${error.campo}"]`);
    const campoInput = document.querySelector<HTMLElement>(`[data-campo="${error.campo}"]`);

    // Ya hay un mensaje puesto para este campo (mostramos solo el primero).
    if (nodoError && nodoError.textContent) continue;

    if (nodoError) {
      nodoError.textContent = error.mensaje;
      nodoError.classList.remove('hidden');
    }
    if (campoInput) {
      campoInput.setAttribute('aria-invalid', 'true');
    }
  }

  const banner = document.querySelector<HTMLElement>('[data-error-for="general"]');
  if (banner) {
    if (mensajesGenerales.length > 0) {
      banner.textContent = mensajesGenerales.join(' ');
      banner.classList.remove('hidden');
    } else {
      banner.textContent = '';
      banner.classList.add('hidden');
    }
  }
}
