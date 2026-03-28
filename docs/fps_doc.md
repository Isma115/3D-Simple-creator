# Documentacion de FPS (`src/fps.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo calcula cuantas imagenes por segundo esta dibujando la aplicacion. Sirve para enseñar un numero estable en pantalla cuando activas `Ver -> Mostrar FPS`.

## Explicacion Tecnica
`src/fps.js` expone `createFpsTracker(sampleSize)` y devuelve un objeto con `tick(timestamp)`.

- Guarda el tiempo del ultimo fotograma.
- En cada llamada calcula el tiempo transcurrido entre fotogramas y lo convierte a FPS.
- Mantiene una pequena ventana de muestras recientes para sacar un promedio y evitar que el numero salte demasiado.
- Devuelve ese promedio para que la UI lo pinte sin mezclar el calculo con el render o con el menu nativo.
