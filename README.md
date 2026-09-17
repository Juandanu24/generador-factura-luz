# Generador de factura de luz

Calculadora de la factura de energía eléctrica en Colombia. Uno digita el consumo
en kWh que marca el medidor en un momento cualquiera del mes y la app responde dos
preguntas:

1. **¿Cuánta plata llevo?** — el valor de lo consumido hasta hoy.
2. **¿Cuánto va a llegar?** — la proyección al cierre del ciclo de facturación,
   si el ritmo de consumo se mantiene.

Además compara el consumo proyectado contra el del mes anterior.

## Arrancar

```bash
npm install
npm run dev
```

La app queda en `http://localhost:4321`.

### Probarla desde el celular

El servidor de desarrollo está configurado con `server.host: true`, así que también
escucha en la IP de la red local. Astro imprime la dirección al arrancar:

```
Network  http://192.168.1.X:4321/
```

Con el celular en la misma red WiFi, abrir esa dirección. La interfaz está diseñada
mobile-first justamente para usarse parado frente al medidor.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción a `dist/` |
| `npm run preview` | Sirve el build de producción |
| `npm run test` | Pruebas unitarias del motor de cálculo (Vitest) |
| `npm run typecheck` | Verificación de tipos (`astro check`) |

## Cómo se calcula

### Consumo del periodo

```
consumo = consumoDirecto  ó  (lecturaActual − lecturaAnterior)
```

### Tramos de consumo

El **consumo de subsistencia** es el tope mensual hasta donde el Estado subsidia la
energía. Parte el consumo en dos tramos:

```
tramoSubsidiado = min(consumo, consumoSubsistenciaKwh)
tramoPleno      = max(0, consumo − consumoSubsistenciaKwh)
```

| Altitud del municipio | Tope de subsistencia |
|---|---|
| ≥ 1000 m.s.n.m. | 130 kWh/mes |
| < 1000 m.s.n.m. | 173 kWh/mes |

### Ajuste por estrato

Subsidio y contribución **no se comportan igual**, y esa asimetría es la parte que más
se presta a error:

- **Subsidio** (estratos 1–3, porcentaje negativo): aplica **sólo al tramo de subsistencia**.
  El excedente se cobra a costo unitario pleno.

  ```
  energiaSubsidiada = tramoSubsidiado × CU × (1 + pct/100)
  energiaPlena      = tramoPleno × CU
  ajusteEstrato     = tramoSubsidiado × CU × pct/100        (negativo: es ahorro)
  ```

- **Contribución** (estratos 5, 6 y comercial, porcentaje positivo): aplica sobre
  **todo el consumo**.

  ```
  energiaSubsidiada = tramoSubsidiado × CU × (1 + pct/100)
  energiaPlena      = tramoPleno × CU × (1 + pct/100)
  ajusteEstrato     = consumo × CU × pct/100                (positivo: es recargo)
  ```

- **Estrato 4**: tarifa plena, sin ajuste.

Porcentajes sugeridos de arranque (aproximados salvo el de estrato 2, que está
medido sobre un recibo real; todos editables en la app):

| Estrato | Ajuste sobre el CU |
|---|---|
| 1 | −60 % |
| 2 | −37,29 % |
| 3 | −15 % |
| 4 | 0 % |
| 5 | +20 % |
| 6 | +20 % |
| comercial | +20 % |

### Resto del recibo

```
costoEnergia     = energiaSubsidiada + energiaPlena
alumbradoPublico = costoEnergia × alumbradoPublicoPct/100     (default 13 %)
aseo             = valor fijo                                 (default $39.490)
total            = costoEnergia + alumbradoPublico + aseo
```

El aseo es un valor fijo: no se le aplica ningún porcentaje encima.

### Proyección a fin de ciclo

```
diasTranscurridos     = fechaLectura − fechaInicioCiclo        (mínimo 1)
consumoDiarioPromedio = consumo / diasTranscurridos
consumoProyectado     = consumoDiarioPromedio × diasCiclo
```

El desglose proyectado sale de correr el mismo motor con `consumoProyectado`. El tope
de subsistencia es mensual, así que se compara contra el consumo proyectado completo,
no contra el parcial: un consumo de 100 kWh en 10 días proyecta 300 kWh al mes, y sólo
los primeros 130 (o 173) llevan subsidio.

### Comparativa con el mes anterior

Se compara el consumo **proyectado** contra el del mes anterior — contrastar diez días
contra un mes completo no dice nada. La tendencia usa una banda muerta de ±2 % para no
reportar ruido como si fuera un cambio real.

## De dónde sale cada dato en un recibo real

| Campo de la app | Dónde buscarlo |
|---|---|
| Lectura anterior / actual | Sección de lecturas del medidor |
| Costo unitario (CU) | Renglón "costo unitario" o "$/kWh" del detalle de energía |
| % de subsidio o contribución | Renglón "subsidio" o "contribución" del detalle |
| Consumo de subsistencia | Depende de la altitud del municipio (tabla de arriba) |
| Alumbrado público | Renglón de impuestos del recibo |
| Aseo | Renglón del servicio de aseo |
| Días del ciclo | Periodo facturado |

## Recibo de referencia

Los valores por defecto no son inventados: salen de una factura real de **Afinia
(Caribemar de la Costa)** en **Montería, estrato 2 residencial**, periodo
16/07/2026 – 17/08/2026. El motor reproduce esa factura al peso, y la prueba
`src/lib/__tests__/recibo-real.test.ts` lo verifica en cada corrida.

| Concepto | Recibo | Calculado |
|---|---|---|
| Consumo | 993 kWh | 993 kWh |
| Tramo subsidiado | 1.008,41 × 173 = $174.454,93 | igual |
| Tramo pleno | 1.008,41 × 820 = $826.896,20 | igual |
| Subsidio | −$65.048,00 | igual |
| Subtotal energía | $936.303,13 | igual |
| Alumbrado público | $121.719,41 | igual |

Dos cosas que ese recibo corrigió respecto de los supuestos iniciales:

1. **El alumbrado público es 13 %, no 15 %.** $121.719,41 sobre $936.303,13 da
   exactamente 13 %. El 15 % que suele citarse no aplica en este municipio.
2. **El subsidio de estrato 2 es −37,29 %, no −50 %.** El recibo lo expresa como
   un descuento absoluto de **$376,00 por kWh** sobre los primeros 173 kWh, que
   contra un CU de $1.008,41 equivale a −37,2864 %.

La diferencia entre el total calculado y el facturado es de unos $190, y
corresponde a conceptos que la v1 no modela: interés por mora, aproximación a
decenas y redondeos de facturaciones anteriores.

## Supuestos y limitaciones de la v1

Esto es una **estimación**, no la factura oficial. En concreto:

- Todos los parámetros se digitan a mano. La app no consulta ninguna fuente externa.
- Los porcentajes por estrato son **valores aproximados de arranque**. Los reales
  cambian por resolución de la CREG, por comercializadora y por región; hay que
  sobrescribirlos con lo que diga el recibo propio.
- El 13 % de alumbrado público y los $39.490 de aseo vienen del recibo de
  referencia, no son constantes nacionales. El alumbrado público lo fija cada
  municipio y el aseo depende del operador y del aforo.
- **El subsidio se modela como porcentaje del CU, pero los recibos lo expresan en
  $/kWh.** Mientras el CU no cambie son equivalentes; cuando cambia, el porcentaje
  deja de corresponder y hay que recalcularlo. Ver issue #17.
- La proyección asume consumo lineal: no modela picos de fin de semana, ni clima, ni
  electrodomésticos que entran y salen.
- No se modelan conceptos que sí aparecen en recibos reales: saldos anteriores,
  financiaciones, reconexiones, ajustes al decimal, alumbrado público con tope o
  tarifa fija.

## Hoja de ruta

La v2 apunta a quitarle al usuario la digitación manual:

- Lectura automática del recibo mensual (PDF, imagen o correo) para extraer lecturas,
  consumo y tarifas
- Consumo de las tarifas de energía desde una fuente externa en vez de digitar el CU
- Tabla oficial de subsidios y contribuciones por estrato, versionada por fecha de
  vigencia

Ver los issues etiquetados `v2` en el repositorio.

## Estructura

```
src/
  lib/          motor de cálculo, funciones puras y sin dependencias de UI
    types.ts    contrato de datos compartido entre el motor y la interfaz
  data/         valores por defecto y tabla de estratos
  components/   componentes de interfaz
  scripts/      lógica de cliente (persistencia local)
  pages/        rutas de Astro
```
