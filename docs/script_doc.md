# Documentación del Entry Point (`script.js`)

## Explicación Sencilla (No Técnica)
Este archivo pone en marcha toda la aplicación. Crea la escena 3D, conecta los controles, enlaza la interfaz con el modelado, activa la edición de texturas, prepara la exportación y ahora también permite cargar modelos `OBJ`, `FBX` y proyectos guardados del propio editor.

## Explicación Técnica
`script.js` es el punto de arranque del proyecto y coordina los módulos principales.

Hace lo siguiente:
- Inicializa escena, cámara, renderer y controles orbitales.
- Crea el estado compartido y los gestores de puntos, bloques, caras, grafos, undo/redo, limpieza, texturas, UV, FPS, importación y proyectos.
- Registra el punto de origen inicial para el sistema de líneas y caras.
- Conecta teclado, selección con ratón, controles de bloques con ratón y menú contextual de bloques.
- Mantiene una función `updateUI()` que recalcula vértices visibles, sincroniza el panel superior y habilita o deshabilita acciones de selección y texturas.
- Escucha acciones del menú nativo o HTML para limpiar, fusionar, abrir `Editar UV`, exportar, guardar proyecto y cargar modelos o proyectos.
- Antes de exportar, reutiliza el mismo limpiador de líneas sin cara para no sacar geometría auxiliar al archivo final.
- Usa `createModelImporter(...)` para vaciar el modelo actual y reconstruirlo con las mallas importadas.
- Usa `createProjectIO(...)` para guardar un snapshot editable completo y restaurarlo después.
- Ejecuta un bucle de animación sencillo: actualiza FPS, refresca `OrbitControls` y renderiza la escena principal.

El antiguo flujo del modo 4 vistas ya no forma parte del arranque ni del renderizado.
