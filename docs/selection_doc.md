# Documentacion de Seleccion (`src/selection.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo permite elegir con el raton un punto o un cubo del modelo segun el modo activo. Al pasar el cursor por encima, el elemento se marca en naranja. En modo bloques con teclado, al hacer click se selecciona para seguir dibujando desde ahi o borrarlo con el teclado. Si no hay un punto existente (modo normal), puedes pasar por la rejilla del plano y se marcara un punto intermedio para poder seleccionar esa posicion aunque no exista como vertice del modelo.

## Explicacion Tecnica
`src/selection.js` usa `Raycaster` de Three.js sobre las esferas de puntos o los cubos, dependiendo de `state.controlMode`, y controla el estado de hover/seleccion. El punto seleccionado se guarda en `state.selectedEntry` y el punto bajo el cursor en `state.hoveredEntry`. Para cubos usa `state.selectedBlock` y `state.hoveredBlock`. En modo bloques con raton solo mantiene el hover para mostrar el bloque bajo el cursor, dejando los clicks a `mouse_blocks.js`. Cuando no hay un punto bajo el cursor en modo normal, intenta intersectar las caras de plano creadas en `planeFill`, calcula el punto de la rejilla mas cercano dentro de las celdas y muestra un marcador temporal. Al hacer click en ese punto, actualiza la posicion del cursor y reinicia la ruta activa sin crear un vertice real en el modelo.
