# Documentacion de Estadisticas (`src/stats.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo calcula los numeros que se muestran en el panel de estadisticas: cuantas caras hay, cuantos vertices, puntos y lineas.

## Explicacion Tecnica
`src/stats.js` expone `computeVisibleVertices(state)` (que combina bordes de caras en plano y caras libres) y `computeStats(state, entryManager, visibleVertices)` y devuelve un objeto con:
- `faces`: suma de caras en plano y caras libres.
- `vertices`: cantidad de vertices visibles en el borde de las caras.
- `points`: total de puntos del modelo (aunque esten ocultos visualmente).
- `lines`: total de lineas visibles.

Los valores se usan para refrescar el panel de UI sin mezclar calculos con renderizado.
