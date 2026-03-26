# Documentacion del Modo de Trabajo Multivista (`src/workspace_mode.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo activa una forma nueva de trabajar: en vez de ver solo una camara 3D, divide la pantalla en cuatro vistas tecnicas del modelo y deja una previsualizacion 3D grande a la derecha. Sirve para construir el volumen con mas precision, viendo al mismo tiempo como encajan los puntos y las lineas desde arriba y desde los laterales.

## Explicacion Tecnica
`src/workspace_mode.js` crea un controlador que:
- Activa o desactiva el modo global `blueprint` mediante `setMode(mode)`.
- Calcula un layout de cinco ventanas sobre el mismo `renderer`: cuatro proyecciones ortograficas (`top`, `right`, `left`, `bottom`) y una vista perspectiva de previsualizacion.
- Usa `setViewport` y `setScissor` de Three.js para renderizar cada vista en una zona distinta del canvas principal sin crear renderizadores extra.
- Reposiciona camaras ortograficas alrededor del bounding box actual del modelo para que el conjunto siempre quede centrado y con margen.
- Convierte clicks del usuario en coordenadas 3D alineadas a rejilla usando `Raycaster` contra planos fijos (`x = constante` o `y = constante`) segun la vista activa.
- Permite tres acciones basicas en ese modo:
  - seleccionar un punto existente con clic,
  - mover el cursor de construccion con clic sobre espacio vacio,
  - unir el punto o cursor activo con otro punto o con una nueva posicion usando `Mayus + clic`, reutilizando `drawLineBetweenPoints(...)`.
- Muestra una previsualizacion temporal de la union antes de confirmar el click y resalta el punto cercano cuando existe uno.
- Desactiva `OrbitControls` mientras el modo esta activo para que el usuario no mueva accidentalmente la camara principal mientras dibuja sobre las vistas ortograficas.
