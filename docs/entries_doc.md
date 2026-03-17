# Documentacion de Entradas de Lineas y Puntos (`src/entries.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo decide que lineas y puntos deben verse u ocultarse cuando una cara los tapa. Tambien se encarga de registrar cada nueva linea y punto.

## Explicacion Tecnica
`src/entries.js` expone `createEntryManager(scene, planeFill)` y devuelve:
- `registerLineEntry` y `registerPointEntry` para crear entradas con estado. Los puntos pueden pertenecer a origen de lineas o bloques.
- `refreshEntryVisibility` que agrega o quita un mesh de la escena segun si esta activo o cubierto.
- `updatePlaneVisibility` que revisa si un plano relleno cubre lineas y actualiza su visibilidad.
- `applyVisibleVertices` decide que puntos se muestran segun el conjunto de vertices visibles, marca uno por vertice como visible permanente y evita duplicados por vertice. En modo puntos fuerza que todos los vertices sean elegibles para mostrar/seleccionar.
- `setHovered` y `setSelected` controlan el resaltado del punto bajo el cursor o seleccionado.
- `getLineEntries` expone las lineas registradas para operaciones como el borrado.
- `getPointEntriesByKey` permite acceder a puntos por vertice para activar o desactivar los que vienen de bloques.
- `movePointEntries` permite reubicar un vertice y mantener sincronizado el indice interno por clave.
- `getCounts` devuelve solo elementos visibles para el panel de estadisticas.

Internamente usa un conjunto `coveredBy` por entrada para saber que planos la cubren.
