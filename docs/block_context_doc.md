# Documentacion del Menu de Bloques (`src/block_context.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo muestra un pequeño menu al hacer click derecho sobre un bloque de figura geométrica cuando estas usando bloques con teclado. Desde ese menu puedes:
- **Dividir**: Partir el cubo en 8 cubos mas pequeños y seguir trabajando con ellos.

El desplazamiento ahora se activa simplemente haciendo click izquierdo sobre un cubo o figura movible, pero solo si realmente ha sido un click corto. Si arrastras para mover la camara, no se activa el gizmo. Cuando el click es valido aparece el gizmo de flechas de colores para mover la pieza libremente. Para confirmar la posición final y evitar conflictos gráficos (z-fighting) al fusionar figuras, solo tienes que pulsar la tecla Enter o Escape.

## Explicacion Tecnica
`src/block_context.js` expone `attachBlockContextMenu(...)` que:
- Escucha el evento `contextmenu` en el canvas cuando `controlMode` es `blocks-keyboard`.
- Usa `Raycaster` para detectar el bloque bajo el cursor.
- Muestra un menu flotante con la accion "Dividir".
- Llama a `blockManager.splitBlock` y registra una accion `block-split` en `undoManager` para la división.
- Para desplazar, escucha `pointerdown`/`pointerup` sobre bloques activos y solo activa `TransformControls` si el puntero apenas se ha movido entre ambos eventos. La pieza pulsada pasa a ser tambien la seleccionada persistente, por lo que permanece naranja mientras siga siendo la referencia actual. Durante el arrastre se desactiva `OrbitControls` para evitar giro de cámara. Al pulsar Escape/Enter, se registra un evento `block-move` en el `undoManager` y reposiciona la entidad lógicamente usando `blockManager.updateBlockPosition()`.
- Oculta el menu cuando se hace click fuera o se cambia de modo.
