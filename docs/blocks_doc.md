# Documentacion de Bloques (`src/blocks.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo gestiona los cubos del modo bloques. Se encarga de crear, mostrar, ocultar y resaltar los cubos cuando pasas el raton o los seleccionas.

## Explicacion Tecnica
`src/blocks.js` expone `createBlockManager({ scene, state })` y devuelve:
- `registerBlock(position)` para crear un cubo en una posicion de la rejilla o reactivar uno ya existente.
- `refreshEntryVisibility` para anadir o quitar el mesh de la escena y actualizar su color.
- `setHovered` y `setSelected` para resaltar un cubo en naranja cuando el usuario lo apunta o lo selecciona.
- `getBlockEntries`, `getBlockByMesh` y `getBlockByKey` para soporte de raycasting, busqueda rapida y operaciones de borrado.

Cada cubo se almacena como una entrada con estado (`active`, `hovered`, `selected`) y un mesh propio clonado del material base.
