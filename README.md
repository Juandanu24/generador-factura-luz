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

Porcentajes sugeridos de arranque (aproximados, editables en la app):

| Estrato | Ajuste sobre el CU |
|---|---|
| 1 | −60 % |
| 2 | −50 % |
| 3 | −15 % |
| 4 | 0 % |
| 5 | +20 % |
| 6 | +20 % |
| comercial | +20 % |

### Resto del recibo

```
costoEnergia     = energiaSubsidiada + energiaPlena
alumbradoPublico = costoEnergia × alumbradoPublicoPct/100     (default 15 %)
aseo             = valor fijo                                 (default $40.000)
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

## Supuestos y limitaciones de la v1

Esto es una **estimación**, no la factura oficial. En concreto:

- Todos los parámetros se digitan a mano. La app no consulta ninguna fuente externa.
- Los porcentajes por estrato son **valores aproximados de arranque**. Los reales
  cambian por resolución de la CREG, por comercializadora y por región; hay que
  sobrescribirlos con lo que diga el recibo propio.
- El 15 % de alumbrado público y los $40.000 de aseo son defaults configurables, no
  constantes nacionales. El alumbrado público lo fija cada municipio y el aseo depende
  del operador y del aforo.
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
