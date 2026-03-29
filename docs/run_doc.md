# Documentación del Script de Ejecución (`run.py`)

## Explicación Sencilla (No Técnica)
Este archivo abre la aplicación como programa de escritorio. Levanta un pequeño servidor local, abre la ventana de la app y la cierra por completo cuando cierras esa ventana. Además crea los menús nativos del sistema para no depender de una barra HTML.

## Explicación Técnica
`run.py` combina un servidor HTTP mínimo con `pywebview` cuando está disponible.

Puntos clave:
- Busca un puerto libre automáticamente para evitar conflictos.
- Sirve los archivos del proyecto con `SimpleHTTPRequestHandler`.
- Mantiene un sistema de heartbeat para apagar el servidor si la app deja de responder o se cierra.
- Cuando `pywebview` está disponible, abre la URL local dentro de una ventana nativa y fuerza un fondo negro desde el primer fotograma para evitar el destello blanco inicial.
- Construye menús nativos de `Archivo`, `Edición`, `Inventario` y `Ver`.
- Los menús envían eventos personalizados al frontend usando `window.evaluate_js(...)`, así que la lógica real sigue centralizada en JavaScript.
- `Archivo` expone guardar proyecto, cargar proyecto, cargar `OBJ`, cargar `FBX`, exportar `GLB` y exportar `OBJ`.
- `Edición` agrupa limpiar líneas, fusionar bloques, fusionar selección y abrir `Editar UV`.

Si `pywebview` no existe, conserva un modo de respaldo en navegador.
