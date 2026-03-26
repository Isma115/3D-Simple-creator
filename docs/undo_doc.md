# Documentacion de Undo/Redo (`src/undo.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo guarda cada paso que haces (incluyendo borrar puntos o cubos) y permite deshacer o rehacer con los atajos de teclado. Asi puedes corregir errores sin perder el dibujo completo.

## Explicacion Tecnica
`src/undo.js` expone `createUndoManager(...)` que devuelve:
- `pushAction` para almacenar una accion nueva.
- `performUndo` y `performRedo` para revertir o repetir cambios.

Cada accion guarda referencias a lineas, puntos, cubos, caras, vertices de caras y cambios en planos (incluyendo los vertices de borde del relleno). El modulo tambien soporta acciones de borrado que pueden afectar multiples lineas y puntos a la vez, y conserva los meshes de caras libres para restaurarlos. Para los bloques usa acciones separadas de alta/baja, una accion especial de division (`block-split`) que reactiva el bloque padre y apaga los hijos al deshacer, y una acción de desplazamiento (`block-move`) que manipula el índice posicional para revertir el bloque movido a su origen. Tambien restaura la posicion del cursor. Al deshacer o rehacer, restaura el estado visual y las estructuras internas (registros de caras, planos, grafos y vertices de caras libres).
