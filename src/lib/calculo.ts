/**
 * Motor de calculo puro de la factura de energia: validacion, consumo del
 * periodo y desglose en pesos.
 *
 * Todas las funciones de este archivo son puras: no leen el reloj, no tocan
 * el DOM ni hacen I/O. Los valores en pesos se devuelven crudos, sin
 * redondear; el redondeo a peso entero es responsabilidad de `formato.ts`.
 */

import type { DesgloseFactura, EntradaFactura, ErrorValidacion } from '@/lib/types';

/**
 * Valida los datos digitados por el usuario y devuelve la lista de errores
 * encontrados (vacia si todo esta bien). Los mensajes estan en espaniol,
 * listos para mostrar al usuario final.
 */
export function validarEntrada(entrada: EntradaFactura): ErrorValidacion[] {
  const errores: ErrorValidacion[] = [];

  const tieneLecturas =
    entrada.lecturaAnterior !== undefined && entrada.lecturaActual !== undefined;
  const tieneConsumoDirecto = entrada.consumoDirecto !== undefined;

  if (!tieneLecturas && !tieneConsumoDirecto) {
    errores.push({
      campo: 'general',
      mensaje:
        'Ingresa las lecturas del medidor (anterior y actual) o el consumo del periodo en kWh.',
    });
  }

  if (
    entrada.lecturaAnterior !== undefined &&
    entrada.lecturaActual !== undefined &&
    entrada.lecturaActual < entrada.lecturaAnterior
  ) {
    errores.push({
      campo: 'lecturaActual',
      mensaje: 'La lectura actual no puede ser menor que la lectura anterior.',
    });
  }

  if (entrada.lecturaAnterior !== undefined && entrada.lecturaAnterior < 0) {
    errores.push({
      campo: 'lecturaAnterior',
      mensaje: 'La lectura anterior no puede ser negativa.',
    });
  }

  if (entrada.lecturaActual !== undefined && entrada.lecturaActual < 0) {
    errores.push({
      campo: 'lecturaActual',
      mensaje: 'La lectura actual no puede ser negativa.',
    });
  }

  if (entrada.consumoDirecto !== undefined && entrada.consumoDirecto < 0) {
    errores.push({
      campo: 'consumoDirecto',
      mensaje: 'El consumo no puede ser negativo.',
    });
  }

  if (entrada.costoUnitarioKwh <= 0) {
    errores.push({
      campo: 'costoUnitarioKwh',
      mensaje: 'El costo unitario del kWh debe ser mayor que cero.',
    });
  }

  if (!Number.isFinite(entrada.diasCiclo) || entrada.diasCiclo < 1 || entrada.diasCiclo > 62) {
    errores.push({
      campo: 'diasCiclo',
      mensaje: 'La duracion del ciclo debe estar entre 1 y 62 dias.',
    });
  }

  if (entrada.consumoSubsistenciaKwh < 0) {
    errores.push({
      campo: 'consumoSubsistenciaKwh',
      mensaje: 'El tope de consumo de subsistencia no puede ser negativo.',
    });
  }

  if (entrada.valorAseo < 0) {
    errores.push({
      campo: 'valorAseo',
      mensaje: 'El valor del aseo no puede ser negativo.',
    });
  }

  if (
    !Number.isFinite(entrada.ajustePorEstratoPct) ||
    entrada.ajustePorEstratoPct < -100 ||
    entrada.ajustePorEstratoPct > 100
  ) {
    errores.push({
      campo: 'ajustePorEstratoPct',
      mensaje: 'El ajuste por estrato debe estar entre -100% y 100%.',
    });
  }

  if (
    !Number.isFinite(entrada.alumbradoPublicoPct) ||
    entrada.alumbradoPublicoPct < 0 ||
    entrada.alumbradoPublicoPct > 100
  ) {
    errores.push({
      campo: 'alumbradoPublicoPct',
      mensaje: 'El porcentaje de alumbrado publico debe estar entre 0% y 100%.',
    });
  }

  if (
    entrada.fechaInicioCiclo &&
    entrada.fechaLectura &&
    entrada.fechaLectura < entrada.fechaInicioCiclo
  ) {
    errores.push({
      campo: 'fechaLectura',
      mensaje: 'La fecha de lectura no puede ser anterior al inicio del ciclo.',
    });
  }

  return errores;
}

/**
 * Calcula el consumo del periodo en kWh: usa `consumoDirecto` si esta
 * presente, o la diferencia entre lecturas en caso contrario.
 */
export function calcularConsumo(entrada: EntradaFactura): number {
  if (entrada.consumoDirecto !== undefined) {
    return entrada.consumoDirecto;
  }

  const anterior = entrada.lecturaAnterior ?? 0;
  const actual = entrada.lecturaActual ?? 0;
  return actual - anterior;
}

/**
 * Calcula el desglose completo de la factura en pesos para un consumo dado.
 *
 * Si no se pasa `consumoKwh`, se calcula con `calcularConsumo(entrada)`.
 * Funcion pura: no redondea, no hace I/O.
 */
export function calcularFactura(entrada: EntradaFactura, consumoKwh?: number): DesgloseFactura {
  const consumo = consumoKwh ?? calcularConsumo(entrada);
  const { costoUnitarioKwh: cu, ajustePorEstratoPct: pct, consumoSubsistenciaKwh } = entrada;

  const tramoSubsidiado = Math.min(consumo, consumoSubsistenciaKwh);
  const tramoPleno = Math.max(0, consumo - consumoSubsistenciaKwh);

  let energiaSubsidiada: number;
  let energiaPlena: number;
  let ajusteEstrato: number;

  if (pct < 0) {
    // Subsidio: solo aplica sobre el tramo de subsistencia.
    energiaSubsidiada = tramoSubsidiado * cu * (1 + pct / 100);
    energiaPlena = tramoPleno * cu;
    ajusteEstrato = tramoSubsidiado * cu * (pct / 100);
  } else if (pct > 0) {
    // Contribucion: aplica sobre todo el consumo.
    energiaSubsidiada = tramoSubsidiado * cu * (1 + pct / 100);
    energiaPlena = tramoPleno * cu * (1 + pct / 100);
    ajusteEstrato = consumo * cu * (pct / 100);
  } else {
    // Estrato 4: tarifa plena, sin ajuste.
    energiaSubsidiada = tramoSubsidiado * cu;
    energiaPlena = tramoPleno * cu;
    ajusteEstrato = 0;
  }

  const costoEnergia = energiaSubsidiada + energiaPlena;
  const alumbradoPublico = costoEnergia * (entrada.alumbradoPublicoPct / 100);
  const aseo = entrada.valorAseo;
  const total = costoEnergia + alumbradoPublico + aseo;

  return {
    consumoKwh: consumo,
    energiaSubsidiada,
    energiaPlena,
    ajusteEstrato,
    costoEnergia,
    alumbradoPublico,
    aseo,
    total,
  };
}
