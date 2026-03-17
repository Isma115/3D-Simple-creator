# Documentacion de Teclado (`src/input.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo escucha las teclas de flechas para dibujar o colocar cubos con teclado, los atajos de deshacer/rehacer y la tecla de borrar para eliminar el elemento seleccionado. Es la puerta de entrada de los controles del usuario.

## Explicacion Tecnica
`src/input.js` expone `attachKeyboardControls(...)` que:
- Interpreta flechas en funcion de la orientacion de la camara.
- En modo normal crea nuevas lineas y puntos, registra acciones y actualiza la UI.
- En modo bloques con teclado crea cubos alineados a la rejilla segun el tamano del cubo seleccionado y actualiza la posicion del cursor sin tocar la logica de caras.
- En modo bloques con raton ignora las flechas para que el control sea exclusivamente con clicks.
- Detecta bucles para generar caras mediante `faceController`.
- Invoca `undoManager` cuando el usuario pulsa Ctrl/Command + Z o Y.
- Atiende `Delete` o `Backspace` para eliminar el vertice seleccionado (o el punto bajo el cursor) en modo normal, y para borrar el cubo seleccionado en modo bloques, registrando todo como una accion deshacer/rehacer.

Mantener esta logica separada evita mezclar input con renderizado.
