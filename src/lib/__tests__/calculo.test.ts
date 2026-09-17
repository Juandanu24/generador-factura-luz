import { describe, expect, it } from 'vitest';
import { calcularConsumo, calcularFactura, validarEntrada } from '@/lib/calculo';
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

describe('calcularConsumo', () => {
  it('usa consumoDirecto cuando esta presente', () => {
    expect(calcularConsumo(base({ consumoDirecto: 200 }))).toBe(200);
  });

  it('resta las lecturas cuando no hay consumoDirecto', () => {
    expect(
      calcularConsumo(base({ lecturaAnterior: 1000, lecturaActual: 1250 })),
    ).toBe(250);
  });
});

describe('calcularFactura - tramos por estrato', () => {
  it('estrato 1, consumo bajo el tope: todo subsidiado, energiaPlena === 0', () => {
    const entrada = base({
      estrato: 1,
      ajustePorEstratoPct: -60,
      consumoSubsistenciaKwh: 173,
      consumoDirecto: 100,
    });
    const desglose = calcularFactura(entrada);
    expect(desglose.energiaPlena).toBe(0);
    expect(desglose.energiaSubsidiada).toBeCloseTo(100 * 900 * 0.4, 6);
    expect(desglose.ajusteEstrato).toBeLessThan(0);
  });

  it('estrato 2, consumo sobre el tope: tramo mixto (subsidiado + pleno)', () => {
    const entrada = base({
      estrato: 2,
      ajustePorEstratoPct: -50,
      consumoSubsistenciaKwh: 173,
      consumoDirecto: 250,
    });
    const desglose = calcularFactura(entrada);
    expect(desglose.energiaSubsidiada).toBeGreaterThan(0);
    expect(desglose.energiaPlena).toBeGreaterThan(0);
    // Subsidio solo sobre el tramo de subsistencia (173 kWh), tarifa plena en el resto (77 kWh).
    expect(desglose.energiaSubsidiada).toBeCloseTo(173 * 900 * 0.5, 6);
    expect(desglose.energiaPlena).toBeCloseTo(77 * 900, 6);
  });

  it('estrato 4: sin ajuste, ajusteEstrato === 0', () => {
    const entrada = base({ estrato: 4, ajustePorEstratoPct: 0, consumoDirecto: 200 });
    const desglose = calcularFactura(entrada);
    expect(desglose.ajusteEstrato).toBe(0);
    expect(desglose.costoEnergia).toBeCloseTo(200 * 900, 6);
  });

  it('estrato 6: contribucion positiva aplicada sobre TODO el consumo', () => {
    const entrada = base({
      estrato: 6,
      ajustePorEstratoPct: 20,
      consumoSubsistenciaKwh: 173,
      consumoDirecto: 250,
    });
    const desglose = calcularFactura(entrada);
    expect(desglose.ajusteEstrato).toBeGreaterThan(0);
    expect(desglose.ajusteEstrato).toBeCloseTo(250 * 900 * 0.2, 6);
    // La contribucion tambien encarece el tramo pleno, a diferencia del subsidio.
    expect(desglose.energiaPlena).toBeCloseTo(77 * 900 * 1.2, 6);
  });
});

describe('calcularFactura - resto del recibo', () => {
  it('el alumbrado publico es exactamente el % configurado del costo de energia', () => {
    const entrada = base({ alumbradoPublicoPct: 15, consumoDirecto: 200, ajustePorEstratoPct: 0 });
    const desglose = calcularFactura(entrada);
    expect(desglose.alumbradoPublico).toBeCloseTo(desglose.costoEnergia * 0.15, 6);
  });

  it('el aseo se cobra integro, sin que le apliquen porcentajes', () => {
    const entrada = base({ valorAseo: 40000, consumoDirecto: 200 });
    const desglose = calcularFactura(entrada);
    expect(desglose.aseo).toBe(40000);
  });

  it('consumo 0: el total es igual al aseo, sin NaN', () => {
    const entrada = base({ consumoDirecto: 0 });
    const desglose = calcularFactura(entrada);
    expect(Number.isNaN(desglose.total)).toBe(false);
    expect(desglose.total).toBe(entrada.valorAseo);
    expect(desglose.costoEnergia).toBe(0);
  });

  it('caso end-to-end realista: ~250 kWh, CU ~$900, estrato 3', () => {
    const entrada = base({
      estrato: 3,
      ajustePorEstratoPct: -15,
      consumoSubsistenciaKwh: 173,
      costoUnitarioKwh: 900,
      consumoDirecto: 250,
      alumbradoPublicoPct: 15,
      valorAseo: 40000,
    });
    const desglose = calcularFactura(entrada);
    expect(desglose.total).toBeGreaterThan(150000);
    expect(desglose.total).toBeLessThan(300000);
    expect(Number.isNaN(desglose.total)).toBe(false);
  });
});

describe('validarEntrada', () => {
  it('reporta error cuando la lectura actual es menor que la anterior', () => {
    const errores = validarEntrada(
      base({ lecturaAnterior: 1000, lecturaActual: 900 }),
    );
    expect(errores.some((e) => e.campo === 'lecturaActual')).toBe(true);
  });

  it('reporta error general cuando no hay lecturas ni consumoDirecto', () => {
    const errores = validarEntrada(base());
    expect(errores.some((e) => e.campo === 'general')).toBe(true);
  });

  it('no reporta errores para una entrada valida', () => {
    const errores = validarEntrada(base({ consumoDirecto: 200 }));
    expect(errores).toHaveLength(0);
  });

  it('reporta error cuando el costo unitario es <= 0', () => {
    const errores = validarEntrada(base({ consumoDirecto: 200, costoUnitarioKwh: 0 }));
    expect(errores.some((e) => e.campo === 'costoUnitarioKwh')).toBe(true);
  });

  it('reporta error cuando diasCiclo esta fuera de 1-62', () => {
    const errores = validarEntrada(base({ consumoDirecto: 200, diasCiclo: 90 }));
    expect(errores.some((e) => e.campo === 'diasCiclo')).toBe(true);
  });

  it('reporta error cuando fechaLectura es anterior a fechaInicioCiclo', () => {
    const errores = validarEntrada(
      base({
        consumoDirecto: 200,
        fechaInicioCiclo: '2026-08-15',
        fechaLectura: '2026-08-01',
      }),
    );
    expect(errores.some((e) => e.campo === 'fechaLectura')).toBe(true);
  });
});
