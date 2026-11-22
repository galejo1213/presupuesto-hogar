# Presupuesto del hogar — v2 (especificación)

## Objetivo
App de presupuesto para dos personas, instalable en iPhone, privada y rápida de usar en el día a día.

## Decisiones
- **Formato:** PWA (manifest + íconos), instalable con "Agregar a pantalla de inicio". Sin App Store.
- **Ubicación:** `/v2` del mismo GitHub Pages. La v1 no se toca hasta aprobar la v2.
- **Acceso:** login con Google (Firebase Auth). Las reglas de Realtime Database solo permiten los dos correos de la pareja. Las reglas viven en la consola de Firebase, **nunca en este repo** (es público).
- **Recordatorios:** solo dentro de la app (sin notificaciones push).
- **Apple Pay:** automatización "Transacción" de Atajos abre `v2/?monto=…&comercio=…` con el gasto prellenado.
- **Descartado:** conexión bancaria directa (Plaid/Flinks): requiere dar acceso bancario a terceros.

## Privacidad (prioridad #1)
- Ninguna cifra, correo ni nombre real en el código: ingresos base, nombres y montos viven solo en la base protegida.
- Nunca se guardan números de tarjeta ni de cuenta: las tarjetas son solo etiquetas.
- Botón "ocultar cifras" (difumina todos los montos).
- Aviso visible si la base responde sin login (reglas sin cerrar).
- Todo texto ingresado se escapa antes de mostrarse.

## Datos (`v2/` en RTDB)
```
v2/config
  personas/{p1|p2}: { nombre, base }
  categorias/{catId}: { label, icon, orden, subs/{subId}: label }
  fijos/{id}: { label, catId, subId, monto, dia }   ← plan recurrente (dia 0 = sin fecha)
  version: 3                                          ← modelo plan + pagos
v2/meses/{YYYY-MM}
  ingresos/{p1|p2}/{id}: { label, monto }            ← base precargada + extras (monto < 0 = descuento)
  presuVariable: número                               ← margen para gastos fuera del plan
  fijos/{id}: { label, catId, subId, monto, dia }     ← plan del mes (lo previsto)
  gastos/{id}: { catId, subId, monto, fecha, nota, planId? }  ← pagos hechos (lo real)
```
Objetos por id (no arrays) y escrituras por ruta: dos teléfonos editando a la vez no se pisan.

## Cálculos
- Ingresos = suma de ingresos del mes.
- Una línea del plan queda cubierta por los pagos de su misma categoría › subcategoría (a mano, atajo o ✓).
- Pagado = suma de pagos. Por pagar = Σ max(0, previsto − pagado) por línea.
- Proyección del mes = pagado + por pagar. Presupuestado = plan + margen.
- Disponible al cierre = ingresos − proyección.
- Estado de una línea: pagado · faltan $X (parcial) · atrasado · vence hoy · en N días (≤3) · día N · este mes (sin fecha).

## Pantallas
- **Inicio:** mes actual (toca para cambiar), balance, próximos pagos (marcar pagado con un toque), gasto por categoría.
- **Movimientos:** lista del mes con filtro por categoría; tocar para editar o borrar.
- **Ajustes:** nombres e ingresos base, pagos fijos, categorías y subcategorías, atajo de Apple Pay, cerrar sesión.
- **Botón +:** hoja inferior con monto → categoría → subcategoría → guardar.
- **Meses:** crear cualquier mes (también 2027+), borrar, agrupados por año. El mes del calendario se crea solo con ingresos base y fijos de la plantilla.

## Migración
- Si `v2/` está vacío, se importan una vez los meses y categorías de la v1.
- Una vez (config.version ≠ 3): los montos de diciembre 2026 de la v1 pasan a ser el plan de diciembre (sin pagos); la pareja marca qué líneas se repiten cada mes.

## Fuera de alcance
Notificaciones push, modo sin conexión (service worker), app nativa, conexión bancaria.
