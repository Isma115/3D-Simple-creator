# Documentación de UI en JS (`src/ui.js`)

## Explicación Sencilla (No Técnica)
Este módulo conecta lo que pulsas en pantalla con la lógica real del programa. Se encarga de abrir y cerrar menús, cambiar el modo de control, mostrar el aviso flotante del cambio de modo, abrir el selector de archivos para importar modelos y gestionar la ventana de texturas.

## Explicación Técnica
`src/ui.js` expone `createUI()` y devuelve una API para el resto del sistema.

Responsabilidades principales:
- Formatear y actualizar las coordenadas visibles con `update({ position })`.
- Escuchar los radio buttons del tipo de control y reenviar el valor elegido con `onControlModeChange(handler)`.
- Mostrar u ocultar subcontroles compactos asociados al modo activo, como la caja numérica de `Caras vecinas`.
- Gestionar los menús HTML de respaldo (`Archivo`, `Edición`, `Inventario`, `Ver`) con apertura exclusiva, cierre al pulsar fuera y cierre con `Escape`.
- Abrir el input oculto de importación y reenviar `{ file, format }` mediante `onImportModel(handler)`.
- Conectar botones de exportación, limpieza, fusión y `Editar UV` sin mezclar esa lógica con Three.js.
- Recibir eventos `simple3d-native-menu` enviados por la ventana de escritorio y traducirlos al mismo flujo de UI del navegador.
- Mantener el toast temporal de `Ctrl + rueda` para recorrer modos de control.
- Mantener un panel de ayuda todavía más compacto, generado por modo como líneas simples de texto plano.
- Mostrar u ocultar la ventana modal de texturas y sincronizar el alcance UV (`selection` o `model`).

La idea es que `src/ui.js` concentre toda la coordinación del DOM y deje fuera del resto de módulos cualquier detalle de botones, dropdowns o inputs ocultos.
