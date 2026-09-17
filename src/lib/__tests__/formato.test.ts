import { describe, expect, it } from 'vitest';
import { formatearCOP, formatearKwh, formatearPct } from '@/lib/formato';

describe('formatearCOP', () => {
  it('formatea en pesos colombianos, sin decimales', () => {
    expect(formatearCOP(123456)).toBe('$ 123.456');
  });

  it('redondea a peso entero', () => {
    expect(formatearCOP(99999.6)).toBe('$ 100.000');
  });

  it('no muestra "-0" para valores que redondean a cero negativo', () => {
    expect(formatearCOP(-0.1)).toBe('$ 0');
  });
});

describe('formatearKwh', () => {
  it('formatea con un decimal y sufijo kWh', () => {
    expect(formatearKwh(123.44)).toBe('123,4 kWh');
  });

  it('formatea enteros con ",0"', () => {
    expect(formatearKwh(250)).toBe('250,0 kWh');
  });
});

describe('formatearPct', () => {
  it('antepone "+" a valores positivos', () => {
    expect(formatearPct(12.5)).toBe('+12,5 %');
  });

  it('muestra "-" para valores negativos', () => {
    expect(formatearPct(-8)).toBe('-8,0 %');
  });

  it('no antepone signo a cero', () => {
    expect(formatearPct(0)).toBe('0,0 %');
  });
});
