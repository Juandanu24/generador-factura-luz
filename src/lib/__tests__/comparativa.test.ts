import { describe, expect, it } from 'vitest';
import { compararConMesAnterior } from '@/lib/comparativa';
import type { DesgloseFactura } from '@/lib/types';

function desglose(overrides: Partial<DesgloseFactura> = {}): DesgloseFactura {
  return {
    consumoKwh: 250,
    energiaSubsidiada: 0,
    energiaPlena: 0,
    ajusteEstrato: 0,
    costoEnergia: 200000,
    alumbradoPublico: 30000,
    aseo: 40000,
    total: 270000,
    ...overrides,
  };
}

describe('compararConMesAnterior', () => {
  it('devuelve undefined cuando no hay datos del mes anterior', () => {
    expect(compararConMesAnterior(desglose())).toBeUndefined();
    expect(compararConMesAnterior(desglose(), 200)).toBeUndefined();
  });

  it('calcula deltas y tendencia "exceso" cuando el consumo sube mas de 2%', () => {
    const comparativa = compararConMesAnterior(desglose({ consumoKwh: 250, total: 270000 }), 200, 220000);
    expect(comparativa).toBeDefined();
    expect(comparativa!.deltaKwh).toBe(50);
    expect(comparativa!.deltaPct).toBeCloseTo(25, 6);
    expect(comparativa!.deltaValor).toBe(50000);
    expect(comparativa!.tendencia).toBe('exceso');
  });

  it('tendencia "ahorro" cuando el consumo baja mas de 2%', () => {
    const comparativa = compararConMesAnterior(desglose({ consumoKwh: 150, total: 150000 }), 200, 220000);
    expect(comparativa!.tendencia).toBe('ahorro');
  });

  it('tendencia "igual" dentro de la banda muerta de +/-2%', () => {
    const comparativa = compararConMesAnterior(desglose({ consumoKwh: 201, total: 221000 }), 200, 220000);
    expect(comparativa!.tendencia).toBe('igual');
  });

  it('protege contra division por cero cuando el consumo del mes anterior es 0', () => {
    const comparativa = compararConMesAnterior(desglose({ consumoKwh: 100 }), 0, 0);
    expect(comparativa).toBeDefined();
    expect(Number.isNaN(comparativa!.deltaPct)).toBe(false);
    expect(Number.isFinite(comparativa!.deltaPct)).toBe(true);
  });
});
