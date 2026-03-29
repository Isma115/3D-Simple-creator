# Documentación de Selección (`src/selection.js`)

## Explicación Sencilla (No Técnica)
Este módulo se ocupa de elegir con el ratón lo que vas a editar: puntos de líneas, bloques o caras. También se encarga de remarcar lo que está bajo el cursor y de preparar la parte del modelo que se va a texturizar.

## Explicación Técnica
`src/selection.js` usa `THREE.Raycaster` para detectar intersecciones con puntos, bloques y caras según `state.controlMode`.

Entre sus responsabilidades están:
- Gestionar hover y selección de puntos y bloques.
- Permitir selección de cara individual o conjunta para texturas.
- Limpiar la selección de puntos automáticamente al hacer clic izquierdo simple en cualquier parte de la app, sin romper la selección de bloques mientras se está arrastrando la cámara o una pieza.
- Aplicar texturas clonando materiales para no contaminar otras piezas.
- Mantener y reutilizar el ajuste UV cuando una cara ya tenía textura.
- Construir sesiones UV para una cara concreta o para todo el modelo.
- Exponer helpers como `clearSelection()`, `hasUvTarget()` o `applyTexture()`.

La selección sigue estando preparada para el flujo clásico único de la aplicación y ya no delega el ratón a un modo ortográfico separado.
