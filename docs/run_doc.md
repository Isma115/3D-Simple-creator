# Documentación del Script de Ejecución (`run.py`)

## Explicación Sencilla (No Técnica)
Este archivo sirve para abrir la aplicación como una ventana de escritorio. Primero enciende un pequeño servidor interno solo para que la app pueda cargar sus archivos, y después abre una ventana propia del programa para que no dependas del navegador. En esa ventana, los menús `Inventario`, `Edicion` y `Ver` pasan a ser menús nativos del sistema. Si por cualquier motivo ese modo de escritorio no estuviera disponible, puede seguir abriendo la app en el navegador como plan de respaldo.

## Explicación Técnica
El script está escrito en Python y combina librerías estándar con `pywebview` cuando está disponible para envolver la aplicación web en una ventana nativa.

- **Búsqueda Dinámica de Puertos (`find_free_port`)**: Utiliza el módulo `socket` para enlazar temporalmente un socket al puerto `0`, lo que le pide al Sistema Operativo que asigne el primer puerto libre disponible. Esto previene colisiones.
- **Servidor HTTP con Handler Personalizado (`CustomHandler`)**: Hereda de `SimpleHTTPRequestHandler` para interceptar llamadas al endpoint `/heartbeat` (GET) y `/shutdown` (POST), y responde apropiadamente. También silencia los logs de los *heartbeats* en `stdout` para no desordenar la consola.
- **Sistema de Monitorización (*Heartbeats*)**: Un hilo extra ejecuta `monitor_heartbeat`, el cual revisa cíclicamente si han pasado más de una cantidad definida de segundos (`TIMEOUT_SECONDS = 5`) desde el último latido recibido. Si se excede, el script deduce que la pestaña se cerró o perdió conexión, apagando el servidor automáticamente mediante `httpd.shutdown()`. 
- **Beacon de Desconexión Rápida (`/shutdown`)**: Como medida de apagado instantáneo, la página web envía `navigator.sendBeacon('/shutdown')` con el evento `beforeunload`, permitiendo cerrar el servidor al segundo de presionar la "X" en vez de esperar el _timeout_ de inactividad.
- **Ventana de Escritorio con `pywebview`**: Si `pywebview` está instalado, `run.py` crea una ventana nativa apuntando a `http://localhost:<puerto>` y registra el evento de cierre para apagar el servidor en cuanto el usuario cierra la aplicación.
- **Menús Nativos de Ventana**: Construye menús nativos con `webview.menu.Menu` y `MenuAction` para inventario, edición y vista. Sus acciones envían eventos al frontend mediante `window.evaluate_js(...)`, de forma que la lógica sigue viviendo en JavaScript pero la interacción se hace desde el menú del sistema.
- **Servidor en segundo plano**: En vez de bloquear el hilo principal con `serve_forever()`, el servidor HTTP vive en un hilo `daemon`, permitiendo que el hilo principal quede libre para el bucle gráfico de la ventana de escritorio.
- **Apagado unificado (`request_shutdown`)**: El cierre por heartbeat, por cierre manual de la ventana o por excepción converge en la misma función protegida con `Lock`, evitando dobles llamadas a `shutdown()`.
- **Plan de respaldo en navegador**: Si `pywebview` no está disponible, el script conserva el comportamiento anterior y abre el navegador con `webbrowser.open(...)`.
