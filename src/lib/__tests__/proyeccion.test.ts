import { describe, expect, it } from 'vitest';
import { diasEntre, proyectar } from '@/lib/proyeccion';
import type { EntradaFactura } from '@/lib/types';

function base(overrides: Partial<EntradaFactura> = {}): EntradaFactura {
  return {
    fechaInicioCiclo: '2026-08-01',
    fechaLectura: '2026-08-31',
    diasCiclo: 30,
    estrato: 3,
    costoUnitarioKwh: 900,
    ajustePorEstratoPct: -15,
    consumoSubsistenciaKwh: 173,
    alumbradoPublicoPct: 15,
    valorAseo: 40000,
    ...overrides,
  };
}

describe('diasEntre', () => {
  it('calcula la diferencia en dias entre dos fechas locales', () => {
    expect(diasEntre('2026-08-01', '2026-08-15')) .toBe(14);
  });

  it('no sufre el desfase de UTC (America/Bogota es UTC-5)', () => {
    // Si se parsearan como UTC, new Date('2026-01-01') podria mostrar un dia
    // distinto en una zona horaria con offset negativo. Verificamos que la
    // diferencia sea exacta en dias locales, no fraccionaria.
    expect(diasEntre('2026-01-01', '2026-01-02')).toBe(1);
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
  });
});

describe('proyectar', () => {
  it('proyeccion a mitad de ciclo: el consumo proyectado es ~2x el parcial', () => {
    const entrada = base({
      fechaInicioCiclo: '2026-08-01',
      fechaLectura: '2026-08-16', // 15 dias transcurridos de un ciclo de 30
      diasCiclo: 30,
      consumoDirecto: 100,
    });
    const resultado = proyectar(entrada);
    expect(resultado.diasTranscurridos).toBe(15);
    expect(resultado.diasRestantes).toBe(15);
    expect(resultado.aLaFecha.consumoKwh).toBe(100);
    expect(resultado.proyectado.consumoKwh).toBeCloseTo(200, 6);
  });

  it('ciclo ya cumplido: la proyeccion es identica al valor a la fecha', () => {
    const entrada = base({
      fechaInicioCiclo: '2026-08-01',
      fechaLectura: '2026-08-31', // 30 dias transcurridos, ciclo de 30
      diasCiclo: 30,
      consumoDirecto: 250,
    });
    const resultado = proyectar(entrada);
    expect(resultado.diasTranscurridos).toBeGreaterThanOrEqual(entrada.diasCiclo);
    expect(resultado.proyectado.consumoKwh).toBe(resultado.aLaFecha.consumoKwh);
    expect(resultado.proyectado.total).toBe(resultado.aLaFecha.total);
    expect(resultado.diasRestantes).toBe(0);
  });

  it('diasTranscurridos nunca es menor que 1', () => {
    const entrada = base({
      fechaInicioCiclo: '2026-08-10',
      fechaLectura: '2026-08-10', // mismo dia
      consumoDirecto: 5,
    });
    const resultado = proyectar(entrada);
    expect(resultado.diasTranscurridos).toBe(1);
  });

  it('incluye la comparativa cuando hay datos del mes anterior', () => {
    const entrada = base({
      consumoDirecto: 250,
      consumoMesAnteriorKwh: 200,
      valorMesAnterior: 180000,
    });
    const resultado = proyectar(entrada);
    expect(resultado.comparativa).toBeDefined();
  });

  it('omite la comparativa cuando no hay datos del mes anterior', () => {
    const entrada = base({ consumoDirecto: 250 });
    const resultado = proyectar(entrada);
    expect(resultado.comparativa).toBeUndefined();
  });
});
