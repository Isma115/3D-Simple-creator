# Documentacion de Utilidades Geometricas (`src/geometry.js`)

## Explicacion Sencilla (No Tecnica)
Aqui viven las reglas matematicas basicas: comparar puntos, elegir el mejor eje segun la camara, y detectar si un grupo de puntos esta en un mismo plano.

## Explicacion Tecnica
`src/geometry.js` agrupa funciones puras para calculos:
- `getBestAxis` decide el eje del mundo mas alineado con la vista.
- Helpers de precision (`roundCoord`, `pointsEqual`) para evitar errores flotantes.
- Claves para vertices y planos (`getVertexKey`, `getPlaneKey`, `ensureVertex`).
- Deteccion de planos y bucles (`getAxisAlignedPlane`, `findLoopStartIndex`).
- Proyeccion de puntos a 2D para rellenos (`projectPointsToPlane`).

Estas funciones no tocan la escena, solo transforman datos.
