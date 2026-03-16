# Documentacion de Estado (`src/state.js`)

## Explicacion Sencilla (No Tecnica)
Este archivo crea y guarda la "memoria" de la aplicacion: donde esta el cursor, que puntos se han dibujado, los cubos colocados y los materiales de colores que se usan para ver lineas, puntos, caras y bloques.

## Explicacion Tecnica
`src/state.js` exporta `createState(scene)` y devuelve un objeto con:
- Materiales y geometria compartida (lineas, puntos, caras, cursor, cubos y lineas de grid). Las caras se configuran como opacas para evitar artefactos visuales y los puntos se hacen mas pequenos para que no dominen la vista.
- La posicion actual (`currentPosition`) y el mesh del cursor.
- Arrays y mapas para puntos dibujados, rutas activas, registros de caras y vertices de caras libres para estadisticas y visibilidad. Incluye un mapa de meshes de caras libres para poder borrarlas y restaurarlas, referencias al punto seleccionado y al punto bajo el cursor, y el tipo de control activo (`controlMode`) con su seleccion/hover de cubos.
- Pilas de undo/redo y estructuras para grafos de planos y rellenos.

El modulo agrega el cursor a la escena y deja el punto de origen listo para ser registrado por el gestor de entradas.
