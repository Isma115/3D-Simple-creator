# Documentacion de Bloques con Raton (`src/mouse_blocks.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo permite construir cubos con el raton. Incluye dos flujos:
- `Bloques (raton)`: click izquierdo borra un cubo y click derecho coloca uno nuevo en la cara apuntada o sobre el suelo.
- `Picel`: click izquierdo pinta una matriz de bloques (`1x1`, `2x2`, `3x3`, etc.) y click derecho borra en matriz, con traza configurable (`cuadrado`, `circulo`, `rombo`).

Si arrastras para mover la camara, el modulo no coloca ni elimina nada por accidente.
En el modo `Picel` ahora se ve antes una previsualizacion en azul de la matriz que se va a pintar para saber exactamente que se dibujara al hacer click izquierdo.

## Explicacion Tecnica
`src/mouse_blocks.js` expone `attachMouseBlockControls(...)` y:
- Usa `Raycaster` para detectar el cubo apuntado y la cara clicada.
- Registra el inicio del gesto con `pointerdown` y solo confirma la accion si el movimiento no supera un umbral corto, evitando ediciones accidentales durante arrastres con boton izquierdo o derecho.
- En `blocks-mouse`, conserva la semantica clasica: izq borrar, der colocar.
- En `blocks-pixel`, calcula una brocha sobre la cara o el suelo usando tamaño `N` y tipo de traza, genera posiciones discretas en rejilla y aplica altas/bajas por lote.
- En `blocks-pixel`, renderiza una previsualizacion wireframe no interactiva en tiempo real durante `pointermove`, reutilizando la misma resolucion de posiciones que usa la colocacion real.
- Para acciones por lote usa una unica entrada de undo cuando hay creaciones o borrados multiples.
- Sincroniza la posicion del cursor con la ultima pieza afectada para mantener coherencia con el resto del sistema.
