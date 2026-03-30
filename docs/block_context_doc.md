# Documentacion del Menu de Bloques (`src/block_context.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo muestra un pequeño menu al hacer click derecho sobre un bloque de figura geométrica cuando estas usando bloques con teclado. Desde ese menu puedes:
- **Dividir**: Partir el cubo en 8 cubos mas pequeños y seguir trabajando con ellos.
- **Fusionar seleccion**: Combinar varios bloques ya seleccionados sin tener que ir al menu superior.
- **Redimensionar**: Cambiar el gizmo de mover por uno de escala para ampliar o reducir la pieza.

El desplazamiento ahora se activa con doble click izquierdo sobre el mismo cubo o figura movible, y ambos clicks tienen que ser cortos. Si arrastras para mover la camara, no se activa el gizmo. Cuando el doble click es valido aparece el gizmo de flechas de colores para mover la pieza libremente. Desde el mismo menu flotante tambien puedes cambiar a redimensionado, usando el gizmo de escala para ampliar o reducir la pieza. Para confirmar la transformación final y evitar conflictos gráficos (z-fighting) al fusionar figuras, solo tienes que pulsar la tecla Enter o Escape.

## Explicacion Tecnica
`src/block_context.js` expone `attachBlockContextMenu(...)` que:
- Escucha el evento `contextmenu` en el canvas cuando `controlMode` es `blocks-keyboard`.
- Usa `Raycaster` para detectar el bloque bajo el cursor.
- Muestra un menu flotante con las acciones "Dividir", "Fusionar seleccion" y "Redimensionar". Si el bloque pulsado forma parte de una seleccion multiple, las acciones de dividir o fusionar usan esa seleccion como contexto.
- Reutiliza `blockManager.splitBlock` tanto desde ese menu como desde el atajo `Ctrl + D`. Si el raton esta sobre un bloque, el atajo prioriza siempre ese bloque; si ademas pertenece a una seleccion multiple, la accion se aplica a toda esa seleccion y queda registrada como una unica accion `block-split` en `undoManager`.
- Para desplazar, escucha `pointerdown`/`pointerup` sobre bloques activos y solo activa `TransformControls` cuando detecta dos clicks cortos seguidos sobre la misma pieza. Si esa pieza ya formaba parte de una seleccion multiple, conserva la seleccion en lugar de reemplazarla. Durante el arrastre se desactiva `OrbitControls` para evitar giro de cámara. Al pulsar Escape/Enter, registra un evento `block-move` o `block-resize` en el `undoManager` y actualiza la entidad lógicamente usando `blockManager.updateBlockPosition()` o `blockManager.updateBlockDimensions()`.
- Oculta el menu cuando se hace click fuera o se cambia de modo.
