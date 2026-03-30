# Documentación de Selección (`src/selection.js`)

## Explicación Sencilla (No Técnica)
Este módulo se ocupa de elegir con el ratón lo que vas a editar: puntos de líneas, bloques o caras. También se encarga de remarcar lo que está bajo el cursor y de preparar la parte del modelo que se va a texturizar.

## Explicación Técnica
`src/selection.js` usa `THREE.Raycaster` para detectar intersecciones con puntos, bloques y caras según `state.controlMode`.

Entre sus responsabilidades están:
- Gestionar hover y selección de puntos y bloques.
- Permitir selección de cara individual o conjunta para texturas.
- Sumar varias caras manualmente con `Shift + clic` sin perder las ya seleccionadas.
- Permitir un modo específico de `Caras vecinas` que, al pulsar una cara externa de un cubo, añade automáticamente un radio configurable de cubos vecinos en el mismo plano, incluyendo diagonales.
- Evitar que una pieza fusionada se comporte como si todas sus caras fueran una sola cuando usas `Caras vecinas`; ahora conserva solo la cara concreta sobre la que se hizo clic.
- Detectar arrastres cortando el flujo de clic para que mover la camara o arrastrar el raton no deseleccione bloques, caras o puntos por accidente.
- Limpiar la selección de puntos automáticamente al hacer clic izquierdo simple en cualquier parte de la app, sin romper la selección de bloques mientras se está arrastrando la cámara o una pieza.
- Aplicar texturas clonando materiales para no contaminar otras piezas.
- Reaplicar el desplazamiento de la textura solo sobre las caras que ya tenían textura cuando el usuario mueve los sliders rápidos.
- Mantener y reutilizar el ajuste UV cuando una cara ya tenía textura.
- Construir sesiones UV para una cara concreta o para todo el modelo.
- Exponer helpers como `clearSelection()`, `hasUvTarget()` o `applyTexture()`.

La selección sigue estando preparada para el flujo clásico único de la aplicación y ya no delega el ratón a un modo ortográfico separado.
