# Documentación de Importación (`src/import.js`)

## Explicación Sencilla (No Técnica)
Este módulo permite abrir un modelo `OBJ` o `FBX` dentro del editor. Cuando cargas uno de esos archivos, la aplicación vacía el modelo actual y coloca en la escena las piezas importadas para que puedas seguir viéndolas, seleccionándolas, moverlas y volver a exportarlas.

## Explicación Técnica
`src/import.js` expone `createModelImporter(...)`.

Su flujo es:
- Leer el archivo seleccionado desde el input oculto.
- Parsearlo con `OBJLoader` o `FBXLoader` de Three.js según el formato.
- Recorrer el árbol importado y extraer únicamente las mallas.
- Hornear la transformación mundial de cada malla dentro de su geometría (`applyMatrix4`).
- Calcular centro y tamaño de cada pieza para convertirla en una entrada compatible con `blockManager`.
- Clonar materiales para que la edición posterior no modifique referencias compartidas del loader.
- Limpiar por completo el modelo actual, reinicializando selecciones, caras, líneas y pilas de undo/redo.
- Registrar cada malla importada como una pieza editable y exportable mediante `registerCustomBlockShape(...)`.

El módulo prioriza compatibilidad con la app actual: los modelos importados pasan a ser piezas seleccionables del sistema, no simples mallas pasivas de solo visualización.
