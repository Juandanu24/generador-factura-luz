/**
 * Cableado de la pantalla: rehidrata el formulario, escucha los cambios con
 * debounce y recalcula/pinta el resultado en cada uno. Sin boton "calcular".
 */

import { validarEntrada } from '@/lib/calculo';
import { proyectar } from '@/lib/proyeccion';
import { AJUSTE_POR_ESTRATO, entradaPorDefecto } from '@/data/estratos';
import type { EntradaFactura } from '@/lib/types';

import {
  actualizarAtajosSubsistencia,
  actualizarVisibilidadModoConsumo,
  erroresDeCamposVacios,
  escribirEntradaEnFormulario,
  leerEntradaDelFormulario,
  mostrarErrores,
} from '@/scripts/formulario';
import { mostrarEstadoVacio, mostrarResultado } from '@/scripts/resultados';
import { cargarEntrada, guardarEntrada, limpiarEntrada } from '@/scripts/persistencia';

const DEBOUNCE_MS = 150;

/** true una vez que el usuario toca el campo a mano; ahi dejamos de precargarlo por estrato. */
let ajusteEstratoEditadoAMano = false;

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
  mostrarResultado(resultado);
}

const recalcularConDebounce = debounce(recalcular, DEBOUNCE_MS);

function precargarAjustePorEstrato(): void {
  if (ajusteEstratoEditadoAMano) return;

  const selectEstrato = document.getElementById('estrato') as HTMLSelectElement | null;
  const campoAjuste = document.getElementById('ajustePorEstratoPct') as HTMLInputElement | null;
  if (!selectEstrato || !campoAjuste) return;

  const ajuste = AJUSTE_POR_ESTRATO[selectEstrato.value];
  if (ajuste !== undefined) {
    campoAjuste.value = String(ajuste);
  }
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
  document.getElementById('ajustePorEstratoPct')?.addEventListener('input', () => {
    ajusteEstratoEditadoAMano = true;
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
    const nuevaEntrada = limpiarEntrada();
    escribirEntradaEnFormulario(nuevaEntrada);
    recalcular();
  });

  actualizarVisibilidadModoConsumo();
  actualizarAtajosSubsistencia();
  recalcular();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  inicializar();
}
