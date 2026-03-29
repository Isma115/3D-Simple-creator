# Documentación de Entradas de Líneas y Puntos (`src/entries.js`)

## Explicación Sencilla (No Técnica)
Este módulo decide qué puntos y líneas se ven en pantalla y cuáles deben ocultarse porque una cara ya las tapa. También registra cada nuevo punto o línea que el usuario crea.

## Explicación Técnica
`src/entries.js` expone `createEntryManager(scene, planeFill)`.

Ofrece:
- `registerLineEntry(...)` y `registerPointEntry(...)` para guardar nuevas entidades visuales con estado.
- `refreshEntryVisibility(...)` para añadir o quitar un elemento de la escena según si está activo o cubierto.
- `updatePlaneVisibility(...)` para ocultar líneas cubiertas por caras coplanares.
- `applyLooseFaceVisibility(...)` para ocultar bordes cuando una cara libre ya los reemplaza.
- `applyVisibleVertices(...)` para decidir qué vértices pueden verse y seleccionarse.
- Métodos para marcar hover, selección y selección múltiple por clave de vértice.
- Acceso a líneas y puntos existentes para borrado, movimiento o importación de estado.

El criterio actual de visibilidad enseña solo los vértices útiles para el flujo activo y ya no depende de un modo separado de edición de puntos.
