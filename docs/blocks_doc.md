# Documentacion de Bloques (`src/blocks.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo gestiona los cubos del modo bloques. Se encarga de crear, mostrar, ocultar, dividir y resaltar los cubos cuando pasas el raton o los seleccionas.

## Explicacion Tecnica
`src/blocks.js` expone `createBlockManager({ scene, state, entryManager })` y devuelve:
- `registerBlock(position, size)` para crear un cubo en una posicion de la rejilla o reactivar uno ya existente. Permite distintos tamanos.
- `refreshEntryVisibility` para anadir o quitar el mesh de la escena y actualizar su color.
- `setHovered` y `setSelected` para resaltar un cubo en naranja cuando el usuario lo apunta o lo selecciona.
- `getBlockEntries`, `getBlockByMesh` y `getBlockByKey` para soporte de raycasting, busqueda rapida y operaciones de borrado.
- `splitBlock(entry)` para dividir un cubo en 8 cubos mas pequenos de forma recursiva.

Cada cubo se almacena como una entrada con estado (`active`, `hovered`, `selected`), tamano propio y un mesh escalado del material base. Si existe `entryManager`, tambien registra puntos en las esquinas de los cubos activos para que el modo puntos pueda seleccionar vertices del modelo hecho con bloques.
