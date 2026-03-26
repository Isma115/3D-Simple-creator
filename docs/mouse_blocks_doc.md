# Documentacion de Bloques con Raton (`src/mouse_blocks.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo permite construir cubos con el raton al estilo "Minecraft". Con click izquierdo borras un cubo y con click derecho colocas uno nuevo en la cara que estas apuntando o sobre el suelo. Si arrastras para mover la camara, el modulo no coloca ni elimina nada por accidente.

## Explicacion Tecnica
`src/mouse_blocks.js` expone `attachMouseBlockControls(...)` y:
- Usa `Raycaster` para detectar el cubo apuntado y la cara clicada.
- Registra el inicio del gesto con `pointerdown` y solo confirma la accion en `pointerup` si el raton casi no se ha movido, evitando ediciones accidentales cuando el usuario realmente estaba arrastrando la vista.
- Con click izquierdo desactiva el cubo y registra la accion en undo/redo.
- Con click derecho calcula la posicion adyacente a la cara y crea un nuevo cubo, o coloca un cubo en el plano del suelo si no hay ninguno bajo el cursor.
- Sincroniza la posicion del cursor con el ultimo bloque colocado para mantener coherencia con el resto del sistema.
