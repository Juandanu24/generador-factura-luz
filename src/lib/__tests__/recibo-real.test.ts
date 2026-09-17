/**
 * Prueba de regresion contra una factura real emitida.
 *
 * Recibo de Afinia (Caribemar de la Costa S.A.S. E.S.P.), Monteria, estrato 2
 * residencial, periodo facturado 16/07/2026 - 17/08/2026, 32 dias.
 *
 * Datos tomados del recibo:
 *   Lectura anterior      7401 kWh   (16/07/2026)
 *   Lectura actual        8394 kWh   (17/08/2026)
 *   Consumo                993 kWh
 *   CU                 1.008,41 $/kWh
 *   Subsidio             376,00 $/kWh sobre los primeros 173 kWh
 *   Energia            936.303,13 $   (antes de mora y aproximacion a decenas)
 *   Alumbrado publico  121.719,41 $   (13% exacto de la energia)
 *   Aseo                39.490,00 $
 *   Total mes        1.097.700    $
 *
 * Si el motor deja de reproducir estas cifras, el cambio que lo rompio esta
 * mal: esta es la unica verificacion del proyecto contra una fuente real.
 */
import { describe, expect, it } from 'vitest';
import { calcularFactura } from '@/lib/calculo';
import { RECIBO_REFERENCIA } from '@/data/estratos';
import type { EntradaFactura } from '@/lib/types';

const CU = 1008.41;
const SUBSIDIO_POR_KWH = 376.0;
const SUBSISTENCIA = 173;

const recibo: EntradaFactura = {
  lecturaAnterior: 7401,
  lecturaActual: 8394,
  fechaInicioCiclo: '2026-07-16',
  fechaLectura: '2026-08-17',
  diasCiclo: 32,
  estrato: 2,
  costoUnitarioKwh: CU,
  // El recibo da el subsidio en $/kWh; el motor lo modela como % del CU.
  ajustePorEstratoPct: (-SUBSIDIO_POR_KWH / CU) * 100,
  consumoSubsistenciaKwh: SUBSISTENCIA,
  alumbradoPublicoPct: 13,
  valorAseo: 39490,
};

describe('recibo real de Afinia, Monteria, estrato 2', () => {
  const d = calcularFactura(recibo);

  it('reproduce el consumo facturado', () => {
    expect(d.consumoKwh).toBe(993);
  });

  it('parte el consumo en 173 kWh subsidiados y 820 plenos', () => {
    // El recibo desglosa: 1.008,41 x 173 y 1.008,41 x 820
    expect(d.energiaPlena).toBeCloseTo(820 * CU, 2); // 826.896,20
    expect(d.energiaSubsidiada).toBeCloseTo(SUBSISTENCIA * CU - SUBSISTENCIA * SUBSIDIO_POR_KWH, 2);
  });

  it('aplica el subsidio solo sobre el tramo de subsistencia', () => {
    // El recibo: -65.048,00 = 376,00 x 173. Si el subsidio se aplicara sobre
    // los 993 kWh el ahorro seria de $373.368 y la factura saldria mal.
    expect(d.ajusteEstrato).toBeCloseTo(-65048, 2);
  });

  it('reproduce el subtotal de energia', () => {
    expect(d.costoEnergia).toBeCloseTo(936303.13, 2);
  });

  it('el alumbrado publico es 13% de la energia, no 15%', () => {
    expect(d.alumbradoPublico).toBeCloseTo(121719.41, 2);
  });

  it('el total queda a menos de $250 del facturado', () => {
    // La diferencia son conceptos que la v1 no modela: interes por mora,
    // aproximacion a decenas y redondeos de facturaciones anteriores.
    expect(Math.abs(d.total - 1097700)).toBeLessThan(250);
  });

  it('los valores por defecto coinciden con los del recibo de referencia', () => {
    expect(RECIBO_REFERENCIA.costoUnitarioKwh).toBe(CU);
    expect(RECIBO_REFERENCIA.alumbradoPublicoPct).toBe(13);
    expect(RECIBO_REFERENCIA.valorAseo).toBe(39490);
    expect(RECIBO_REFERENCIA.consumoSubsistenciaKwh).toBe(SUBSISTENCIA);
  });
});
