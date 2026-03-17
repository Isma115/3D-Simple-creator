# Documentacion del Menu de Bloques (`src/block_context.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo muestra un pequeño menu al hacer click derecho sobre un cubo cuando estas usando bloques con teclado. Desde ese menu puedes elegir "Dividir" para partir el cubo en 8 cubos mas pequenos y seguir trabajando con ellos.

## Explicacion Tecnica
`src/block_context.js` expone `attachBlockContextMenu(...)` que:
- Escucha el evento `contextmenu` en el canvas cuando `controlMode` es `blocks-keyboard`.
- Usa `Raycaster` para detectar el cubo bajo el cursor.
- Muestra un menu flotante con la accion "Dividir".
- Llama a `blockManager.splitBlock` y registra una accion `block-split` en `undoManager`.
- Oculta el menu cuando se hace click fuera o se cambia de modo.
