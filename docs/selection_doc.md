# Documentacion de Seleccion (`src/selection.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo permite elegir con el raton un punto, un cubo del modelo, o una cara segun el modo activo. Al pasar el cursor por encima, el elemento se marca en naranja o gris. En modo bloques con teclado, al hacer click se selecciona para seguir dibujando desde ahi o borrarlo con el teclado. Si estás en modo seleccionar cara, resaltará la cara bajo el ratón y la seleccionará al hacer click para poder aplicar texturas. Si no hay un punto existente (modo normal), puedes pasar por la rejilla del plano y se marcara un punto intermedio para poder seleccionar esa posicion aunque no exista como vertice del modelo.

## Explicacion Tecnica
`src/selection.js` usa `Raycaster` de Three.js sobre las esferas de puntos o los cubos y caras 2D, dependiendo de `state.controlMode`, y controla el estado de hover/seleccion. El punto seleccionado se guarda en `state.selectedEntry` y el punto bajo el cursor en `state.hoveredEntry`. Para cubos usa `state.selectedBlock` y `state.hoveredBlock`, y para texturizar almacena variables como `state.hoveredFace` y `state.selectedFace`. En modo seleccionar cara y modo bloques los elementos reciben realces visuales (color emissive).
