# Documentacion de Escena (`src/scene.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo prepara el escenario 3D: crea el fondo, la camara, las luces y los controles del raton. Tambien coloca una rejilla gris azulada muy sutil solo para guiar la vista. El aspecto general se ha enfriado y oscurecido para acercarse mas al ambiente de un editor 3D tipo Blender sin copiarlo tal cual.

## Explicacion Tecnica
`src/scene.js` expone `initScene()` que:
- Crea `THREE.Scene`, `PerspectiveCamera` y `WebGLRenderer`.
- Configura un fondo gris azulado sin niebla para mantener una vista limpia del modelo en todo el espacio.
- Inicializa `OrbitControls` con damping para movimiento fluido.
- Ajusta el renderer a `SRGBColorSpace` para una salida mas consistente.
- Anade una rejilla mas marcada y un esquema de iluminacion con `HemisphereLight`, `AmbientLight` y `DirectionalLight`, buscando una lectura de volumen mas parecida a una herramienta de modelado.
- Registra el handler de `resize` para mantener el canvas ajustado.

Devuelve `{ scene, camera, renderer, controls }` para que el entry point pueda conectarlo con el resto del sistema.
