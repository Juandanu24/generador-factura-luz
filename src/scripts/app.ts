/**
 * Cableado de la pantalla: rehidrata el formulario, escucha los cambios con
 * debounce y recalcula/pinta el resultado en cada uno. Sin boton "calcular".
 */

import { validarEntrada } from '@/lib/calculo';
import { proyectar } from '@/lib/proyeccion';
import { AJUSTE_POR_ESTRATO, entradaPorDefecto, pctAPesosPorKwh } from '@/data/estratos';
import type { EntradaFactura } from '@/lib/types';

import {
  actualizarAtajosSubsistencia,
  actualizarVisibilidadModoAjuste,
  actualizarVisibilidadModoConsumo,
  erroresDeCamposVacios,
  escribirEntradaEnFormulario,
  leerEntradaDelFormulario,
  modoAjusteActual,
  mostrarErrores,
  sincronizarCampoAjusteInactivo,
} from '@/scripts/formulario';
import { mostrarEstadoVacio, mostrarResultado } from '@/scripts/resultados';
import { cargarEntrada, guardarEntrada, limpiarEntrada } from '@/scripts/persistencia';

const DEBOUNCE_MS = 150;

/** true una vez que el usuario toca el campo a mano; ahi dejamos de precargarlo por estrato. */
let ajusteEstratoEditadoAMano = false;

/**
 * true una vez que el usuario descarta el aviso de "porcentaje desactualizado"
 * en esta sesion; no vuelve a aparecer aunque siga editando el costo unitario.
 */
let avisoAjusteDescartado = false;

function debounce<T extends (...args: never[]) => void>(fn: T, esperaMs: number): T {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  return ((...args: Parameters<T>) => {
    if (temporizador !== undefined) clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), esperaMs);
  }) as T;
}

function recalcular(): void {
  const entrada: EntradaFactura = leerEntradaDelFormulario();

  // Guardamos siempre lo que el usuario va digitando, aunque este incompleto,
  // para no perderlo si cierra la pestaña a medio llenar.
  guardarEntrada(entrada);

  const errores = [...erroresDeCamposVacios(entrada), ...validarEntrada(entrada)];
  mostrarErrores(errores);

  if (errores.length > 0) {
    // Usamos el primer error tal cual para que el mensaje diga exactamente que falta.
    mostrarEstadoVacio(errores[0].mensaje);
    return;
  }

  const resultado = proyectar(entrada);
  mostrarResultado(resultado, entrada.alumbradoPublicoPct);
}

const recalcularConDebounce = debounce(recalcular, DEBOUNCE_MS);

/**
 * Precarga el ajuste sugerido por estrato (la tabla `AJUSTE_POR_ESTRATO`
 * siempre esta en porcentaje). Actualiza el campo de porcentaje siempre, y
 * tambien el de $/kWh cuando hay un costo unitario utilizable en pantalla,
 * para que la precarga funcione sin importar cual de los dos modos este
 * activo (issue #17).
 */
function precargarAjustePorEstrato(): void {
  if (ajusteEstratoEditadoAMano) return;

  const selectEstrato = document.getElementById('estrato') as HTMLSelectElement | null;
  const campoPct = document.getElementById('ajustePorEstratoPct') as HTMLInputElement | null;
  const campoPesos = document.getElementById('ajustePorKwh') as HTMLInputElement | null;
  const campoCU = document.getElementById('costoUnitarioKwh') as HTMLInputElement | null;
  if (!selectEstrato || !campoPct || !campoPesos) return;

  const ajustePct = AJUSTE_POR_ESTRATO[selectEstrato.value];
  if (ajustePct === undefined) return;

  campoPct.value = String(ajustePct);

  const cu = campoCU ? Number(campoCU.value) : NaN;
  if (Number.isFinite(cu) && cu > 0) {
    campoPesos.value = String(pctAPesosPorKwh(ajustePct, cu));
  }
}

/** Muestra el aviso de "porcentaje posiblemente desactualizado" bajo el campo. */
function mostrarAvisoAjusteDesactualizado(): void {
  document.getElementById('aviso-ajuste-desactualizado')?.classList.remove('hidden');
}

/** Oculta el aviso de "porcentaje posiblemente desactualizado". */
function ocultarAvisoAjusteDesactualizado(): void {
  document.getElementById('aviso-ajuste-desactualizado')?.classList.add('hidden');
}

function inicializar(): void {
  const formulario = document.getElementById('formulario-consumo');
  if (!formulario) return; // el script se carga en paginas sin formulario (no deberia pasar, pero por seguridad)

  const entradaGuardada = cargarEntrada();
  const entradaInicial = entradaGuardada ?? entradaPorDefecto();
  escribirEntradaEnFormulario(entradaInicial);

  // Si el estrato guardado no coincide con el ajuste tipico sugerido,
  // asumimos que el usuario ya lo habia corregido a mano.
  const ajusteSugerido = AJUSTE_POR_ESTRATO[String(entradaInicial.estrato)];
  ajusteEstratoEditadoAMano = ajusteSugerido !== entradaInicial.ajustePorEstratoPct;

  formulario.addEventListener('input', () => recalcularConDebounce());
  formulario.addEventListener('change', () => recalcularConDebounce());

  document.getElementById('modo-lecturas')?.addEventListener('change', actualizarVisibilidadModoConsumo);
  document.getElementById('modo-directo')?.addEventListener('change', actualizarVisibilidadModoConsumo);

  document.getElementById('estrato')?.addEventListener('change', precargarAjustePorEstrato);

  // Alternar entre $/kWh y % convierte el valor con el CU en pantalla, para
  // que el usuario no pierda lo que llevaba digitado (issue #17).
  document.getElementById('modo-ajuste-pesos')?.addEventListener('change', () => {
    actualizarVisibilidadModoAjuste();
    sincronizarCampoAjusteInactivo();
    ocultarAvisoAjusteDesactualizado();
  });
  document.getElementById('modo-ajuste-porcentaje')?.addEventListener('change', () => {
    actualizarVisibilidadModoAjuste();
    sincronizarCampoAjusteInactivo();
  });

  document.getElementById('ajustePorEstratoPct')?.addEventListener('input', () => {
    ajusteEstratoEditadoAMano = true;
    sincronizarCampoAjusteInactivo();
  });
  document.getElementById('ajustePorKwh')?.addEventListener('input', () => {
    ajusteEstratoEditadoAMano = true;
    sincronizarCampoAjusteInactivo();
  });

  // El costo unitario cambia todos los meses: si el usuario lo edita estando
  // en modo porcentaje, el porcentaje que dejo puede haber quedado
  // desactualizado frente al recibo nuevo (issue #17). El modo $/kWh no
  // depende del CU, asi que no necesita este aviso.
  document.getElementById('costoUnitarioKwh')?.addEventListener('input', () => {
    sincronizarCampoAjusteInactivo();
    if (modoAjusteActual() === 'porcentaje' && !avisoAjusteDescartado) {
      mostrarAvisoAjusteDesactualizado();
    }
  });

  document.getElementById('btn-descartar-aviso-ajuste')?.addEventListener('click', () => {
    avisoAjusteDescartado = true;
    ocultarAvisoAjusteDesactualizado();
  });

  const campoSubsistencia = document.getElementById('consumoSubsistenciaKwh') as HTMLInputElement | null;
  document.getElementById('btn-subsistencia-alta')?.addEventListener('click', () => {
    if (campoSubsistencia) campoSubsistencia.value = '130';
    actualizarAtajosSubsistencia();
    recalcular();
  });
  document.getElementById('btn-subsistencia-baja')?.addEventListener('click', () => {
    if (campoSubsistencia) campoSubsistencia.value = '173';
    actualizarAtajosSubsistencia();
    recalcular();
  });
  campoSubsistencia?.addEventListener('input', actualizarAtajosSubsistencia);

  document.getElementById('btn-limpiar')?.addEventListener('click', () => {
    ajusteEstratoEditadoAMano = false;
    avisoAjusteDescartado = false;
    ocultarAvisoAjusteDesactualizado();
    const nuevaEntrada = limpiarEntrada();
    escribirEntradaEnFormulario(nuevaEntrada);
    recalcular();
  });

  actualizarVisibilidadModoConsumo();
  actualizarVisibilidadModoAjuste();
  // Si lo guardado viene de una version anterior (sin `ajustePorKwh`), esto
  // rellena el campo $/kWh a partir del porcentaje para que alternar de modo
  // no lo deje en blanco.
  sincronizarCampoAjusteInactivo();
  actualizarAtajosSubsistencia();
  recalcular();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  inicializar();
}
