# Documentación de Teclado (`src/input.js`)

## Explicación Sencilla (No Técnica)
Este módulo escucha el teclado para dibujar líneas o colocar piezas. Acepta flechas y también `WASD`, además de los atajos de deshacer, rehacer y borrar.

## Explicación Técnica
`src/input.js` expone `attachKeyboardControls(...)`.

Su trabajo principal es:
- Traducir flechas y `WASD` a movimientos relativos a la cámara.
- Crear líneas y puntos nuevos en modo líneas.
- Colocar piezas del inventario en modo bloques con teclado.
- Ignorar el movimiento de teclado cuando el modo activo depende del ratón, como `blocks-mouse`.
- Registrar acciones en undo/redo.
- Gestionar `Delete` y `Backspace` para borrar vértices o todos los bloques seleccionados de una vez.
- Gestionar `X` para borrar directamente el bloque que está bajo el cursor.
- Detectar cierres de bucles para pedir a `faces.js` que genere nuevas caras.

El archivo mantiene la lógica de entrada separada de la escena y de la UI, lo que facilita cambiar controles sin tocar el renderizado.
