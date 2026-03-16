# Documentacion de Caras y Rellenos (`src/faces.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo se encarga de convertir un contorno de puntos en una cara gris. Si la cara esta alineada con los ejes, la rellena como una cuadricula para unir varias caras sin parpadeos.

## Explicacion Tecnica
`src/faces.js` expone `createFaceController(...)` con `processLoopFace`:
- Detecta si el bucle esta en un plano X/Y/Z.
- Si es plano, convierte el poligono a celdas y fusiona el relleno del plano.
- Si no es plano, triangula el contorno y crea una malla independiente. Si los puntos no son coplanares dentro de una tolerancia, se omite la cara para evitar artefactos.

Para las caras en plano, el modulo calcula las esquinas del borde del relleno fusionado y genera una rejilla de lineas grises sobre la cara para mostrar los puntos editables. Para caras libres, guarda los vertices usados y una referencia al mesh para poder mostrarlas, ocultarlas o restaurarlas cuando se hace undo/redo o se borra un punto.

Nota: Las caras se renderizan opacas desde el estado para evitar artefactos de transparencia y orden de dibujado.
