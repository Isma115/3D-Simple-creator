# Documentacion de Estadisticas (`src/stats.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo calcula los numeros que se muestran en el panel de estadisticas: cuantas caras hay, cuantos vertices, puntos y lineas. Ahora ya no depende solo de caras cerradas, asi que tambien refleja bien lo que has construido con lineas o con bloques y figuras.

## Explicacion Tecnica
`src/stats.js` expone `computeVisibleVertices(state)` (que combina bordes de caras en plano y caras libres) y `computeStats(state, entryManager, visibleVertices, blockManager)` y devuelve un objeto con:
- `faces`: suma de caras en plano, caras libres y superficies estimadas de las figuras colocadas en modo bloques.
- `vertices`: total de vertices logicos activos del modelo. En bloques y figuras no usa los vertices internos de la malla renderizada, sino los puntos compartidos que realmente forman la figura.
- `points`: total de puntos logicos activos del modelo.
- `lines`: total de lineas activas del dibujo, aunque visualmente algunas queden cubiertas por caras.

Los valores se usan para refrescar el panel de UI sin mezclar calculos con renderizado.
