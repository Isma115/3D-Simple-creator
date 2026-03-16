# Documentacion de UI en JS (`src/ui.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo actualiza las coordenadas y las estadisticas que ves en el panel. Es el puente entre lo que pasa en el mundo 3D y lo que ves en pantalla.

## Explicacion Tecnica
`src/ui.js` expone `createUI()` y devuelve:
- `update({ position, stats })` para formatear las coordenadas actuales y actualizar los valores de caras, vertices, puntos y lineas en el HTML.
- `onCleanupLines(handler)` para conectar el boton de limpiar lineas con la logica principal.
- `onControlModeChange(handler)` para reaccionar a cambios en los radio buttons del tipo de control.
- `setControlMode(value)` para seleccionar el radio activo desde la logica.

Al estar aislado, la logica de UI no se mezcla con el dibujo 3D.
