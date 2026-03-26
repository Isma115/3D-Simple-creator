# Documentacion de UI en JS (`src/ui.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo actualiza las coordenadas y las estadisticas que ves en el panel. Tambien conecta botones especiales de la interfaz, como el acceso al editor UV. Es el puente entre lo que pasa en el mundo 3D y lo que ves en pantalla. Ademas, permite cambiar de modo de control con `Meta + rueda del raton` sin tener que pulsar directamente los radio buttons y muestra una ventanita flotante durante un instante para indicar el modo activo.

## Explicacion Tecnica
`src/ui.js` expone `createUI()` y devuelve:
- `update({ position, stats })` para formatear las coordenadas actuales y actualizar los valores de caras, vertices, puntos y lineas en el HTML.
- `onCleanupLines(handler)` para conectar el boton de limpiar lineas con la logica principal.
- `onControlModeChange(handler)` para reaccionar a cambios en los radio buttons del tipo de control.
- `setControlMode(value)` para seleccionar el radio activo desde la logica.
- Construye internamente un mapa entre el valor del modo y la etiqueta visible para reutilizar el mismo nombre en la interfaz y en el aviso flotante.
- Registra un listener global de `wheel` en fase de captura que, cuando el usuario mantiene `Meta`, cancela el scroll/zoom por defecto, recorre circularmente los modos de control y dispara el mismo handler que usarian los radio buttons normales.
- Gestiona una ventanita flotante temporal que muestra "Tipo de control" y el nombre del modo elegido. Se activa con `Meta + rueda` y se oculta automaticamente tras 1,5 segundos.
- `onOpenUvEditor(handler)` para el boton global que abre o cierra las herramientas UV.
- `onTextureTargetScopeChange(handler)`, `getTextureTargetScope()` y `setTextureTargetScope(value)` para cambiar entre editar una parte seleccionada o todo el modelo.
- `showTextureManager(show)` e `isTextureManagerVisible()` para abrir o cerrar la ventana modal de texturas sin depender del modo de control actual.

Al estar aislado, la logica de UI no se mezcla con el dibujo 3D.
