# Documentacion de Teclado (`src/input.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo escucha las teclas de movimiento para dibujar o colocar cubos con teclado. Ahora acepta tanto las flechas como `W`, `A`, `S` y `D`, ademas de los atajos de deshacer/rehacer y la tecla de borrar para eliminar el elemento seleccionado. Es la puerta de entrada de los controles del usuario.

## Explicacion Tecnica
`src/input.js` expone `attachKeyboardControls(...)` que:
- Interpreta flechas y `WASD` en funcion de la orientacion de la camara, reutilizando una misma abstraccion interna de direccion (`up`, `down`, `left`, `right`) para que ambos esquemas se comporten igual.
- En modo normal crea nuevas lineas y puntos, registra acciones y actualiza la UI.
- En modo bloques con teclado crea cubos alineados a la rejilla segun el tamano del cubo seleccionado y actualiza la posicion del cursor sin tocar la logica de caras.
    - En modo bloques con raton y en modo puntos ignora las flechas para que el control sea exclusivamente con clicks/arrastre.
- No secuestra combinaciones con `Ctrl` o `Command`, de modo que atajos del sistema como `Cmd+W`, `Ctrl+Z` o `Cmd+A` no entren por la ruta de movimiento de `WASD`.
- Si el programa esta trabajando en el modo global de 4 vistas, ignora las flechas para no mezclar el flujo ortografico con el dibujo clasico, pero mantiene disponibles `undo`, `redo` y borrado.
- Detecta bucles para generar caras mediante `faceController`.
- Invoca `undoManager` cuando el usuario pulsa Ctrl/Command + Z o Y.
- Atiende `Delete` o `Backspace` para eliminar el vertice seleccionado (o el punto bajo el cursor) en modo lineas o puntos, y para borrar el cubo seleccionado en modo bloques, registrando todo como una accion deshacer/rehacer.

Mantener esta logica separada evita mezclar input con renderizado.
