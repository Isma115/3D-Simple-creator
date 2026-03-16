# Documentacion de Escena (`src/scene.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo prepara el escenario 3D: crea el fondo, la camara, las luces y los controles del raton. Tambien coloca una rejilla gris muy sutil solo para guiar la vista. Es el lugar donde se "monta" el espacio en el que dibujas.

## Explicacion Tecnica
`src/scene.js` expone `initScene()` que:
- Crea `THREE.Scene`, `PerspectiveCamera` y `WebGLRenderer`.
- Configura el fondo y la niebla para un ambiente suave.
- Inicializa `OrbitControls` con damping para movimiento fluido.
- Anade guias (grid sutil y ejes) y luces basicas. El grid es transparente para que solo sea visual.
- Registra el handler de `resize` para mantener el canvas ajustado.

Devuelve `{ scene, camera, renderer, controls }` para que el entry point pueda conectarlo con el resto del sistema.
