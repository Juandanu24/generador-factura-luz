/**
 * Contrato de datos compartido entre el motor de calculo (`src/lib`) y la UI
 * (`src/components`, `src/pages`).
 *
 * IMPORTANTE: este archivo es la frontera entre ambas capas. Cambiarlo rompe
 * trabajo en paralelo, asi que cualquier modificacion se acuerda antes.
 */

/** Estrato socioeconomico colombiano o tarifa comercial. */
export type Estrato = 1 | 2 | 3 | 4 | 5 | 6 | 'comercial';

/**
 * Como se expresa el ajuste por estrato.
 *
 * Los recibos colombianos publican el subsidio como un descuento absoluto en
 * $/kWh (ej: "376,00 x 173"), no como porcentaje. Ambas formas son equivalentes
 * mientras el costo unitario no cambie, pero el CU cambia todos los meses: si el
 * usuario lo actualiza y deja el porcentaje viejo, el calculo se desvia en
 * silencio. Por eso `pesosPorKwh` es la forma robusta y la preferida.
 */
export type ModoAjuste = 'porcentaje' | 'pesosPorKwh';

/** Datos que el usuario digita manualmente en la v1. */
export interface EntradaFactura {
  /** Lectura acumulada del medidor al cierre del ciclo anterior, en kWh. */
  lecturaAnterior?: number;
  /** Lectura acumulada del medidor el dia de hoy, en kWh. */
  lecturaActual?: number;
  /** Consumo del periodo en kWh, cuando el usuario prefiere digitarlo directo en vez de las lecturas. */
  consumoDirecto?: number;
  /** Fecha en que arranco el ciclo de facturacion, `yyyy-mm-dd`. */
  fechaInicioCiclo: string;
  /** Fecha en que se tomo `lecturaActual`, `yyyy-mm-dd`. */
  fechaLectura: string;
  /** Duracion total del ciclo de facturacion en dias. Default 30. */
  diasCiclo: number;
  /** Estrato del predio; determina el ajuste sugerido sobre el costo unitario. */
  estrato: Estrato;
  /** Costo unitario de la energia en $/kWh, tomado del recibo. */
  costoUnitarioKwh: number;
  /**
   * Ajuste porcentual sobre el costo unitario segun el estrato.
   * Negativo = subsidio (estratos 1-3). Positivo = contribucion (estratos 5-6 y comercial).
   * Ej: -50 significa 50% de descuento sobre el kWh.
   */
  ajustePorEstratoPct: number;
  /**
   * Como interpretar el ajuste por estrato. Si se omite, se asume
   * `'porcentaje'` y se usa `ajustePorEstratoPct` (comportamiento historico).
   */
  modoAjuste?: ModoAjuste;
  /**
   * Ajuste absoluto sobre el costo unitario, en $/kWh. Solo se usa cuando
   * `modoAjuste` es `'pesosPorKwh'`.
   *
   * Mismo criterio de signo que `ajustePorEstratoPct`: negativo = subsidio,
   * positivo = contribucion. Un recibo que dice "Subsidio 376,00" se digita
   * como `-376`.
   */
  ajustePorKwh?: number;
  /**
   * Tope mensual de consumo de subsistencia en kWh, hasta donde aplica el subsidio.
   * 130 kWh si el municipio esta a 1000 m.s.n.m. o mas, 173 kWh si esta por debajo.
   */
  consumoSubsistenciaKwh: number;
  /** Impuesto de alumbrado publico como porcentaje del costo de energia. Default 15. */
  alumbradoPublicoPct: number;
  /** Valor fijo del servicio de aseo en pesos. Default 40000. */
  valorAseo: number;
  /** Consumo total del mes anterior en kWh, para la comparativa. Opcional. */
  consumoMesAnteriorKwh?: number;
  /** Valor total pagado el mes anterior en pesos, para la comparativa. Opcional. */
  valorMesAnterior?: number;
}

/** Desglose en pesos de un consumo dado. Todos los valores son numeros crudos, sin redondear. */
export interface DesgloseFactura {
  /** Consumo del escenario en kWh. */
  consumoKwh: number;
  /** Valor en $ del tramo de consumo que va hasta el tope de subsistencia, ya con el ajuste aplicado. */
  energiaSubsidiada: number;
  /** Valor en $ del consumo que excede el tope de subsistencia, a costo unitario pleno. */
  energiaPlena: number;
  /** Efecto en $ del estrato: negativo cuando es subsidio (ahorro), positivo cuando es contribucion. */
  ajusteEstrato: number;
  /** Suma de `energiaSubsidiada` + `energiaPlena`, en $. */
  costoEnergia: number;
  /** Impuesto de alumbrado publico en $. */
  alumbradoPublico: number;
  /** Servicio de aseo en $. */
  aseo: number;
  /** Total a pagar en $. */
  total: number;
}

/** Variacion del consumo proyectado frente al mes anterior. */
export interface Comparativa {
  /** Diferencia en kWh entre el consumo proyectado y el del mes anterior. */
  deltaKwh: number;
  /** Variacion porcentual del consumo. */
  deltaPct: number;
  /** Diferencia en $ entre el total proyectado y el del mes anterior. */
  deltaValor: number;
  /** Variacion porcentual del valor. */
  deltaValorPct: number;
  /** Lectura cualitativa del delta, con banda muerta de +/- 2%. */
  tendencia: 'ahorro' | 'exceso' | 'igual';
}

/** Resultado completo que consume la UI. */
export interface ResultadoCalculo {
  /** Desglose del consumo real acumulado hasta `fechaLectura`. */
  aLaFecha: DesgloseFactura;
  /** Desglose del consumo estimado al cierre del ciclo. */
  proyectado: DesgloseFactura;
  /** Dias corridos entre el inicio del ciclo y la lectura. Minimo 1. */
  diasTranscurridos: number;
  /** Dias que faltan para cerrar el ciclo. Nunca negativo. */
  diasRestantes: number;
  /** Promedio de kWh por dia en lo corrido del ciclo. */
  consumoDiarioPromedio: number;
  /** Comparativa con el mes anterior; `undefined` si el usuario no digito esos datos. */
  comparativa?: Comparativa;
}

/** Error de validacion de la entrada, con mensaje listo para mostrar al usuario. */
export interface ErrorValidacion {
  /** Campo de `EntradaFactura` al que corresponde el error. */
  campo: keyof EntradaFactura | 'general';
  /** Mensaje en espaniol, redactado para el usuario final. */
  mensaje: string;
}

/**
 * Un mes ya cerrado, guardado en el historial local del usuario.
 *
 * Clave de diseno: las tarifas (`costoUnitarioKwh`, `ajustePorEstratoPct`,
 * `ajustePorKwh`, `alumbradoPublicoPct`, `valorAseo`, etc.) se congelan dentro
 * de cada registro en vez de leerse de una configuracion global, porque el
 * costo unitario cambia todos los meses. Un historico que solo guardara el
 * consumo y el total, sin las tarifas que los produjeron, no se podria
 * recalcular ni auditar despues: perderia la unica evidencia de "con que
 * tarifa salio este numero". Guardar la tarifa completa por mes es lo que
 * permite, mas adelante, comparar meses entre si o detectar un cambio de
 * tarifa por parte del operador.
 */
export interface RegistroMes {
  /** Identificador unico del registro (UUID o timestamp+random como fallback). */
  id: string;
  /** Nombre para mostrar, ej: "Agosto 2026". Derivado de `fechaLectura`. */
  etiqueta: string;
  /** Fecha en que arranco el ciclo de facturacion, `yyyy-mm-dd`. */
  fechaInicioCiclo: string;
  /** Fecha en que se tomo la lectura de cierre de este registro, `yyyy-mm-dd`. */
  fechaLectura: string;
  /** Duracion total del ciclo de facturacion en dias. */
  diasCiclo: number;
  /** Lectura acumulada del medidor al cierre del ciclo anterior, en kWh. */
  lecturaAnterior?: number;
  /** Lectura acumulada del medidor al cierre de este ciclo, en kWh. */
  lecturaActual?: number;
  /** Consumo del periodo en kWh. */
  consumoKwh: number;
  /** Costo unitario de la energia en $/kWh vigente ese mes, congelado en el registro. */
  costoUnitarioKwh: number;
  /** Como se interpreta `ajustePorEstratoPct` (o `ajustePorKwh`) para este registro. */
  modoAjuste: ModoAjuste;
  /**
   * Ajuste porcentual sobre el costo unitario segun el estrato, congelado ese mes.
   * Negativo = subsidio, positivo = contribucion.
   */
  ajustePorEstratoPct: number;
  /** Ajuste absoluto sobre el costo unitario en $/kWh, congelado ese mes. Solo aplica si `modoAjuste` es `'pesosPorKwh'`. */
  ajustePorKwh?: number;
  /** Tope mensual de consumo de subsistencia en kWh vigente ese mes. */
  consumoSubsistenciaKwh: number;
  /** Impuesto de alumbrado publico como porcentaje del costo de energia, vigente ese mes. */
  alumbradoPublicoPct: number;
  /** Valor fijo del servicio de aseo en pesos, vigente ese mes. */
  valorAseo: number;
  /** Total calculado por el motor de calculo en pesos, para este registro. */
  totalCalculado: number;
  /** Total realmente facturado en pesos, digitado por el usuario al recibir el recibo fisico. Opcional hasta que llegue. */
  totalFacturado?: number;
}
