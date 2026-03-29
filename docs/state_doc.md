# Documentación de Estado (`src/state.js`)

## Explicación Sencilla (No Técnica)
Aquí se guarda la memoria del programa: la posición actual, los materiales, los puntos y caras creados, las selecciones activas, las pilas de deshacer/rehacer y la figura que se está usando para construir.

## Explicación Técnica
`src/state.js` exporta `createState(scene)` y construye el objeto central compartido por los demás módulos.

Incluye:
- Materiales para líneas, puntos, cursor, caras y bloques.
- Geometrías base reutilizables para cubo, esfera, cilindro, pirámide y cono.
- La posición actual (`currentPosition`) y el cursor visible (`cursorMesh`).
- Registros de líneas, caras, grafos planos y vértices del modelo.
- Estructuras para caras libres texturizables (`looseFaceVertices`, `looseFaceMeshes`).
- Estado de selección de puntos, bloques y caras.
- Pilas `undoStack` y `redoStack`.
- El tipo de control activo (`controlMode`), que ahora arranca por defecto en bloques con teclado, y la geometría activa del inventario (`currentGeometryType`).

Aunque todavía conserva `workMode` por compatibilidad interna, la aplicación ya solo usa el flujo clásico de trabajo.
