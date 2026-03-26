# Documentacion de UI en JS (`src/ui.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo actualiza las coordenadas y las estadisticas que ves en el panel. Tambien conecta botones especiales de la interfaz, como el acceso al editor UV. Es el puente entre lo que pasa en el mundo 3D y lo que ves en pantalla. Ademas, permite cambiar de modo de control con `Ctrl + rueda del raton` sin tener que pulsar directamente los radio buttons.

## Explicacion Tecnica
`src/ui.js` expone `createUI()` y devuelve:
- `update({ position, stats })` para formatear las coordenadas actuales y actualizar los valores de caras, vertices, puntos y lineas en el HTML.
- `onCleanupLines(handler)` para conectar el boton de limpiar lineas con la logica principal.
- `onControlModeChange(handler)` para reaccionar a cambios en los radio buttons del tipo de control.
- `setControlMode(value)` para seleccionar el radio activo desde la logica.
- Registra un listener global de `wheel` que, cuando el usuario mantiene `Ctrl`, recorre circularmente los modos de control y dispara el mismo handler que usarian los radio buttons normales.
- `onOpenUvEditor(handler)` para el boton global que abre o cierra las herramientas UV.
- `onTextureTargetScopeChange(handler)`, `getTextureTargetScope()` y `setTextureTargetScope(value)` para cambiar entre editar una parte seleccionada o todo el modelo.
- `showTextureManager(show)` e `isTextureManagerVisible()` para abrir o cerrar la ventana modal de texturas sin depender del modo de control actual.

Al estar aislado, la logica de UI no se mezcla con el dibujo 3D.
