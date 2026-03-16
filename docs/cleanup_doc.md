# Documentacion de Limpieza de Lineas (`src/cleanup.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo elimina las lineas que no sirven para formar una cara. Es util para limpiar el dibujo cuando quedan segmentos sueltos que no aportan a las caras visibles.

## Explicacion Tecnica
`src/cleanup.js` expone `createCleanupManager(...)` con `removeLinesWithoutFace()`:
- Calcula los bordes de las caras en plano a partir de las celdas rellenadas.
- Calcula los bordes de las caras libres usando los vertices guardados.
- Recorre todas las lineas activas y borra solo las que no pertenecen a ningun borde de cara.
- Registra la limpieza como una accion de borrado para que se pueda deshacer o rehacer.
