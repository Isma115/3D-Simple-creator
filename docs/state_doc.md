# Documentacion de Estado (`src/state.js`)

## Explicacion Sencilla (No Tecnica)
Este archivo crea y guarda la "memoria" de la aplicacion: donde esta el cursor, que puntos se han dibujado, los cubos colocados, en que modo global trabaja el programa y los materiales de colores que se usan para ver lineas, puntos, caras y bloques.

## Explicacion Tecnica
`src/state.js` exporta `createState(scene)` y devuelve un objeto con:
- Materiales y diccionario de geometrias compartidas (`geometries` que contiene cubo, esfera, cilindro, etc). Las caras se configuran como opacas para evitar artefactos visuales y los puntos se hacen mas pequenos para que no dominen la vista. El material de las lineas se deja sin `depthWrite` para que las uniones naranjas sigan viendose por encima del modelo. El cubo base se crea sin subdivisiones internas, de modo que solo gana mas detalle cuando el usuario decide dividirlo.
- La posicion actual (`currentPosition`) y el mesh del cursor. Ese cursor naranja se ha dejado muy pequeno para que, al seleccionar cubos o figuras, marque la posicion sin tapar visualmente la pieza.
- Arrays y mapas para puntos dibujados, rutas activas, registros de caras y vertices de caras libres para estadisticas y visibilidad. Incluye un mapa de meshes de caras libres para poder borrarlas y restaurarlas, referencias al punto seleccionado y al punto bajo el cursor, el estado de cara seleccionada o resaltada para texturas (`selectedFace`, `hoveredFace`), el modo global de trabajo (`workMode`) y el tipo de control activo (`controlMode`) con su seleccion/hover de cubos y el tipo de geometria actual (`currentGeometryType`).
- Pilas de undo/redo y estructuras para grafos de planos y rellenos.

El modulo agrega el cursor a la escena y deja el punto de origen listo para ser registrado por el gestor de entradas.
