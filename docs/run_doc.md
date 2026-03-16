# Documentación del Script de Ejecución (`run.py`)

## Explicación Sencilla (No Técnica)
Este archivo sirve para abrir la aplicación. Su única tarea es crear un "mini-servidor web" privado en tu ordenador para que los archivos 3D funcionen correctamente. Además, una vez que enciende el servidor de forma segura, automáticamente te abre una pestaña en tu navegador web por defecto para que puedas empezar a dibujar inmediatamente sin tener que hacer nada más.

## Explicación Técnica
El script está escrito totalmente en Python usando librerías de la biblioteca estándar (built-in), garantizando portabilidad sin necesidad de instalar dependencias externas.

- **Búsqueda Dinámica de Puertos (`find_free_port`)**: Utiliza el módulo `socket` para enlazar temporalmente un socket al puerto `0`, lo que le pide al Sistema Operativo que asigne el primer puerto libre disponible. Esto previene colisiones.
- **Servidor HTTP con Handler Personalizado (`CustomHandler`)**: Hereda de `SimpleHTTPRequestHandler` para interceptar llamadas al endpoint `/heartbeat` (GET) y `/shutdown` (POST), y responde apropiadamente. También silencia los logs de los *heartbeats* en `stdout` para no desordenar la consola.
- **Sistema de Monitorización (*Heartbeats*)**: Un hilo extra ejecuta `monitor_heartbeat`, el cual revisa cíclicamente si han pasado más de una cantidad definida de segundos (`TIMEOUT_SECONDS = 5`) desde el último latido recibido. Si se excede, el script deduce que la pestaña se cerró o perdió conexión, apagando el servidor automáticamente mediante `httpd.shutdown()`. 
- **Beacon de Desconexión Rápida (`/shutdown`)**: Como medida de apagado instantáneo, la página web envía `navigator.sendBeacon('/shutdown')` con el evento `beforeunload`, permitiendo cerrar el servidor al segundo de presionar la "X" en vez de esperar el _timeout_ de inactividad.
- **Apertura de Navegador Asíncrona (`webbrowser` y `threading`)**: Lanza un hilo "demonio" (`daemon=True`) que espera 1 segundo antes de disparar `webbrowser.open(...)` a la URL del puerto asignado dinámicamente.
