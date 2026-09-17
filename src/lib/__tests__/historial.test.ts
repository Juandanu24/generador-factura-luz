import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  eliminarRegistro,
  etiquetaDeMes,
  guardarRegistro,
  listarRegistros,
  registroDesdeEntrada,
  registroMasReciente,
} from '@/lib/historial';
import type { EntradaFactura, RegistroMes } from '@/lib/types';

/**
 * Doble minimo de `Storage` respaldado en memoria, para inyectar en
 * `globalThis.localStorage` en un entorno de pruebas Node (sin DOM).
 */
class StorageFalso implements Storage {
  private datos = new Map<string, string>();

  get length(): number {
    return this.datos.size;
  }

  getItem(clave: string): string | null {
    return this.datos.has(clave) ? this.datos.get(clave)! : null;
  }

  setItem(clave: string, valor: string): void {
    this.datos.set(clave, valor);
  }

  removeItem(clave: string): void {
    this.datos.delete(clave);
  }

  clear(): void {
    this.datos.clear();
  }

  key(indice: number): string | null {
    return [...this.datos.keys()][indice] ?? null;
  }
}

/** Doble de `Storage` que siempre lanza, para simular incognito/cuota llena. */
class StorageQueLanza implements Storage {
  get length(): number {
    throw new Error('storage no disponible');
  }

  getItem(): string | null {
    throw new Error('storage no disponible');
  }

  setItem(): void {
    throw new Error('storage no disponible');
  }

  removeItem(): void {
    throw new Error('storage no disponible');
  }

  clear(): void {
    throw new Error('storage no disponible');
  }

  key(): string | null {
    throw new Error('storage no disponible');
  }
}

const LLAVE_STORAGE = 'factura-luz:historial:v1';

function entradaBase(overrides: Partial<EntradaFactura> = {}): EntradaFactura {
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

function registroBase(overrides: Partial<RegistroMes> = {}): RegistroMes {
  return {
    id: 'r1',
    etiqueta: 'Agosto 2026',
    fechaInicioCiclo: '2026-08-01',
    fechaLectura: '2026-08-31',
    diasCiclo: 30,
    consumoKwh: 200,
    costoUnitarioKwh: 900,
    modoAjuste: 'porcentaje',
    ajustePorEstratoPct: -15,
    consumoSubsistenciaKwh: 173,
    alumbradoPublicoPct: 15,
    valorAseo: 40000,
    totalCalculado: 250000,
    ...overrides,
  };
}

describe('historial', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = new StorageFalso();
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('guardar y luego listar devuelve el registro guardado', () => {
    const registro = registroBase();
    guardarRegistro(registro);
    const lista = listarRegistros();
    expect(lista).toHaveLength(1);
    expect(lista[0]).toEqual(registro);
  });

  it('listarRegistros ordena por fechaLectura descendente', () => {
    guardarRegistro(registroBase({ id: 'a', fechaLectura: '2026-06-30' }));
    guardarRegistro(registroBase({ id: 'b', fechaLectura: '2026-08-31' }));
    guardarRegistro(registroBase({ id: 'c', fechaLectura: '2026-07-31' }));

    const ids = listarRegistros().map((r) => r.id);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  it('guardar con un id ya existente reemplaza el registro, no lo duplica', () => {
    guardarRegistro(registroBase({ id: 'r1', totalCalculado: 100 }));
    guardarRegistro(registroBase({ id: 'r1', totalCalculado: 999 }));

    const lista = listarRegistros();
    expect(lista).toHaveLength(1);
    expect(lista[0].totalCalculado).toBe(999);
  });

  it('eliminarRegistro quita solo el registro indicado', () => {
    guardarRegistro(registroBase({ id: 'a' }));
    guardarRegistro(registroBase({ id: 'b' }));
    guardarRegistro(registroBase({ id: 'c' }));

    eliminarRegistro('b');

    const ids = listarRegistros()
      .map((r) => r.id)
      .sort();
    expect(ids).toEqual(['a', 'c']);
  });

  it('registroMasReciente devuelve el de fechaLectura mayor', () => {
    guardarRegistro(registroBase({ id: 'a', fechaLectura: '2026-06-30' }));
    guardarRegistro(registroBase({ id: 'b', fechaLectura: '2026-08-31' }));
    guardarRegistro(registroBase({ id: 'c', fechaLectura: '2026-07-31' }));

    expect(registroMasReciente()?.id).toBe('b');
  });

  it('registroMasReciente devuelve undefined con historial vacio', () => {
    expect(registroMasReciente()).toBeUndefined();
  });

  it('localStorage que lanza al leer y escribir no rompe: listarRegistros devuelve []', () => {
    (globalThis as { localStorage?: Storage }).localStorage = new StorageQueLanza();

    expect(() => guardarRegistro(registroBase())).not.toThrow();
    expect(listarRegistros()).toEqual([]);
  });

  it('JSON corrupto en el storage produce lista vacia', () => {
    const st = (globalThis as { localStorage: Storage }).localStorage;
    st.setItem(LLAVE_STORAGE, '{ esto no es json valido ');

    expect(listarRegistros()).toEqual([]);
  });

  it('una version distinta de 1 produce lista vacia', () => {
    const st = (globalThis as { localStorage: Storage }).localStorage;
    st.setItem(LLAVE_STORAGE, JSON.stringify({ version: 2, registros: [registroBase()] }));

    expect(listarRegistros()).toEqual([]);
  });

  it('etiquetaDeMes formatea yyyy-mm-dd como "Mes Anio" en fecha local', () => {
    expect(etiquetaDeMes('2026-08-17')).toBe('Agosto 2026');
  });

  it('etiquetaDeMes no se desfasa de zona horaria en el dia 1 del mes', () => {
    expect(etiquetaDeMes('2026-08-01')).toBe('Agosto 2026');
  });

  it('etiquetaDeMes no se desfasa de zona horaria en el dia 31 del mes', () => {
    expect(etiquetaDeMes('2026-08-31')).toBe('Agosto 2026');
  });

  it('registroDesdeEntrada copia las tarifas de la entrada y genera id y etiqueta', () => {
    const entrada = entradaBase({
      lecturaAnterior: 1000,
      lecturaActual: 1200,
      costoUnitarioKwh: 950,
      ajustePorEstratoPct: -50,
      modoAjuste: 'porcentaje',
    });

    const registro = registroDesdeEntrada(entrada, 300000);

    expect(registro.id).toBeTruthy();
    expect(registro.etiqueta).toBe('Agosto 2026');
    expect(registro.consumoKwh).toBe(200);
    expect(registro.costoUnitarioKwh).toBe(950);
    expect(registro.ajustePorEstratoPct).toBe(-50);
    expect(registro.modoAjuste).toBe('porcentaje');
    expect(registro.consumoSubsistenciaKwh).toBe(entrada.consumoSubsistenciaKwh);
    expect(registro.alumbradoPublicoPct).toBe(entrada.alumbradoPublicoPct);
    expect(registro.valorAseo).toBe(entrada.valorAseo);
    expect(registro.totalCalculado).toBe(300000);
  });

  it('registroDesdeEntrada reusa el id explicito en vez de generar uno nuevo', () => {
    const registro = registroDesdeEntrada(entradaBase(), 300000, 'id-fijo');
    expect(registro.id).toBe('id-fijo');
  });
});
