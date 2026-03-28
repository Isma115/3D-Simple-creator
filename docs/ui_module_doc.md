# Documentacion de UI en JS (`src/ui.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo actualiza lo que ves en pantalla y conecta los botones con la logica real del programa. Mantiene visible la posicion del cursor, la figura activa y, si lo activas desde el menu `Ver`, tambien los FPS. Ademas, puede trabajar tanto con los menus HTML de respaldo como con los menus nativos que envia la ventana de escritorio.

## Explicacion Tecnica
`src/ui.js` expone `createUI()` y devuelve:
- `update({ position })` para formatear las coordenadas actuales en el HTML sin recalcular ni pintar contadores.
- `onCleanupLines(handler)` para conectar el boton de limpiar lineas con la logica principal.
- `onControlModeChange(handler)` para reaccionar a cambios en los radio buttons del tipo de control.
- `setControlMode(value)` para seleccionar el radio activo desde la logica.
- Detecta el parametro `nativeMenus=1` en la URL para ocultar la barra de menus HTML cuando la app corre dentro de la ventana de escritorio.
- Controla la apertura y cierre de los menus HTML de respaldo (`Inventario` y `Edicion`), cerrandolos al pulsar fuera, al usar `Escape` o tras ejecutar una accion del menu de edicion.
- Mantiene los selectores de figuras (`geometry-type`) dentro del menu `Inventario` y lo cierra automaticamente cuando cambias la figura activa.
- Escucha el evento global `simple3d-native-menu` para recibir acciones disparadas desde los menus nativos de `pywebview`.
- Expone `setGeometry`, `setFpsVisibility`, `toggleFpsVisibility` y `setFpsValue` para sincronizar la figura activa y el panel opcional de FPS con el estado real del programa.
- Construye internamente un mapa entre el valor del modo y la etiqueta visible para reutilizar el mismo nombre en la interfaz y en el aviso flotante.
- Registra un listener global de `wheel` en fase de captura que, cuando el usuario mantiene `Meta`, cancela el scroll/zoom por defecto, recorre circularmente los modos de control y dispara el mismo handler que usarian los radio buttons normales.
- Gestiona una ventanita flotante temporal que muestra "Tipo de control" y el nombre del modo elegido. Se activa con `Meta + rueda` y se oculta automaticamente tras 1,5 segundos.
- `onOpenUvEditor(handler)` para el boton global que abre o cierra las herramientas UV.
- `onTextureTargetScopeChange(handler)`, `getTextureTargetScope()` y `setTextureTargetScope(value)` para cambiar entre editar una parte seleccionada o todo el modelo.
- `showTextureManager(show)` e `isTextureManagerVisible()` para abrir o cerrar la ventana modal de texturas sin depender del modo de control actual.

Al estar aislado, la logica de UI no se mezcla con el dibujo 3D.
