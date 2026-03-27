# Documentacion de Bloques (`src/blocks.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo gestiona los cubos del modo bloques. Se encarga de crear, mostrar, ocultar, dividir y resaltar los cubos cuando pasas el raton o los seleccionas. Ahora tambien dibuja una malla blanca por encima de cada bloque para que se vean claramente las separaciones entre piezas del modelo. Cuando una pieza queda seleccionada, ella misma permanece en naranja y ya no hace falta un punto aparte para indicarlo.

## Explicacion Tecnica
`src/blocks.js` expone `createBlockManager({ scene, state, entryManager })` y devuelve:
- `registerBlock(position, size)` para crear una figura geométrica (cubo, esfera, cilindro, etc. dependiendo de `state.currentGeometryType`) en una posicion de la rejilla o reactivar uno ya existente. Permite distintos tamanos.
- `registerBox(position, dimensions, size)` para crear prismas rectangulares basados en la geometria de cubo, con escalas independientes por eje. Esto se usa para compactar modelos voxelizados en menos piezas.
- `refreshEntryVisibility` para anadir o quitar el mesh de la escena y actualizar su color.
- `setHovered` y `setSelected` para resaltar un bloque en naranja cuando el usuario lo apunta o lo selecciona.
- `getBlockEntries`, `getBlockByMesh` y `getBlockByKey` para soporte de raycasting, busqueda rapida y operaciones de borrado.
- `canSplitBlock(entry)` y `splitBlock(entry)` para dividir cubos perfectos en 8 bloques mas pequenos de forma recursiva. Los prismas rectangulares fusionados no se dividen desde el menu contextual porque dejarian de ser cubos.
- `optimizeBlocks()` para recorrer todos los cubos activos alineados a la misma rejilla, reconstruir el volumen ocupado en celdas y reagruparlo en el menor numero posible de prismas rectangulares mediante una descomposicion greedy.
- Genera tambien un `EdgesGeometry` blanco por bloque y lo monta como hijo del mesh principal para que el modelo en modo bloques muestre sus divisiones de forma permanente.

Cada bloque se almacena como una entrada con estado (`active`, `hovered`, `selected`), tamano propio, dimensiones reales (`dimensions`), un identificador de geometria (`geometryType`) y un mesh escalado del material base. Si existe `entryManager`, tambien registra puntos en las esquinas del bloque activo para que el modo puntos pueda seleccionar vertices del modelo hecho con bloques. Cuando varios cubos se fusionan en un prisma rectangular, esos puntos tambien se reducen automaticamente a las nuevas esquinas externas.

La ultima pieza seleccionada o colocada puede quedarse marcada en naranja de forma persistente, de modo que siga siendo la referencia visual principal aunque el cursor puntual ya no se muestre en los modos de bloques.
