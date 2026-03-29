import http.server
import socketserver
import webbrowser
import threading
import time
import socket
import os
import json
import base64

try:
    import webview
except ImportError:
    webview = None
    Menu = None
    MenuAction = None
else:
    from webview.menu import Menu, MenuAction

# Tiempo máximo sin recibir un latido (heartbeat) antes de apagar el servidor
TIMEOUT_SECONDS = 5
last_heartbeat = time.time() + 5 # 5 segundos de gracia adicionales al inicio
server_running = True
shutdown_lock = threading.Lock()


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        global last_heartbeat
        if self.path == '/heartbeat':
            last_heartbeat = time.time()
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'OK')
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/shutdown':
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'Shutting down')
            print("\nAplicacion cerrada. Apagando el servidor...")
            request_shutdown(self.server)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Silenciar los logs de heartbeat para no ensuciar la consola
        msg = format % args
        if 'heartbeat' not in msg and 'shutdown' not in msg:
            super().log_message(format, *args)

def monitor_heartbeat(httpd):
    global server_running
    while server_running:
        time.sleep(1)
        if time.time() - last_heartbeat > TIMEOUT_SECONDS:
            print("\nNavegador inactivo (se cerró la pestaña). Apagando servidor...")
            request_shutdown(httpd)
            break

def find_free_port():
    """Encuentra un puerto libre en el sistema."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

def open_browser(port):
    """Espera un momento y abre el navegador."""
    time.sleep(1) # Dar tiempo al servidor para iniciar
    url = f"http://localhost:{port}"
    print(f"Abriendo el navegador en: {url}")
    webbrowser.open(url)


def request_shutdown(httpd):
    global server_running
    with shutdown_lock:
        if not server_running:
            return
        server_running = False
        threading.Thread(target=httpd.shutdown, daemon=True).start()


def dispatch_frontend_event(window, event_name, detail):
    if not window:
        return
    payload = json.dumps(detail)
    script = (
        f"window.dispatchEvent(new CustomEvent({json.dumps(event_name)}, "
        f"{{ detail: {payload} }}));"
    )
    window.evaluate_js(script)


class DesktopBridge:
    def __init__(self, window_holder):
        self.window_holder = window_holder

    def save_export_file(self, data_url, suggested_name, file_type='Archivos (*.*)'):
        window = self.window_holder.get('window')
        if not window:
            return {'saved': False, 'error': 'Ventana no disponible.'}

        destination = window.create_file_dialog(
            webview.SAVE_DIALOG,
            save_filename=suggested_name,
            file_types=(file_type,)
        )

        if not destination:
            return {'saved': False, 'cancelled': True}

        target_path = destination[0] if isinstance(destination, (list, tuple)) else destination

        try:
            _, encoded = data_url.split(',', 1)
            with open(target_path, 'wb') as file_handle:
                file_handle.write(base64.b64decode(encoded))
        except Exception as error:
            return {'saved': False, 'error': str(error)}

        return {'saved': True, 'path': target_path}


def create_native_menu(window_holder):
    def send(action, **extra):
        detail = {'action': action, **extra}
        dispatch_frontend_event(window_holder['window'], 'simple3d-native-menu', detail)

    geometry_items = [
        ('Cubo', 'cube'),
        ('Esfera', 'sphere'),
        ('Cilindro', 'cylinder'),
        ('Piramide', 'pyramid'),
        ('Cono', 'cone')
    ]

    file_menu = Menu(
        'Archivo',
        [
            MenuAction('Guardar proyecto', lambda: send('save-project')),
            MenuAction('Cargar proyecto', lambda: send('load-project')),
            MenuAction('Cargar modelo OBJ', lambda: send('import-obj')),
            MenuAction('Cargar modelo FBX', lambda: send('import-fbx')),
            MenuAction('Exportar GLB', lambda: send('export-gltf')),
            MenuAction('Exportar OBJ', lambda: send('export-obj'))
        ]
    )
    inventory_menu = Menu(
        'Inventario',
        [MenuAction(title, lambda value=value: send('set-geometry', value=value)) for title, value in geometry_items]
    )
    edit_menu = Menu(
        'Edicion',
        [
            MenuAction('Eliminar lineas sin cara', lambda: send('cleanup-lines')),
            MenuAction('Fusionar bloques', lambda: send('merge-blocks')),
            MenuAction('Fusionar seleccion', lambda: send('merge-selected-blocks')),
            MenuAction('Editar UV', lambda: send('open-uv-editor'))
        ]
    )
    view_menu = Menu(
        'Ver',
        [
            MenuAction('Mostrar u ocultar ayuda rapida', lambda: send('toggle-editor-help')),
            MenuAction('Mostrar FPS', lambda: send('toggle-fps'))
        ]
    )
    return [file_menu, edit_menu, inventory_menu, view_menu]


def run_desktop_window(port, httpd):
    url = f"http://localhost:{port}?desktop=1&nativeMenus=1"
    window_holder = {'window': None}
    bridge = DesktopBridge(window_holder)
    menus = create_native_menu(window_holder) if Menu and MenuAction else []
    window = webview.create_window(
        "Simple 3D Creator",
        url=url,
        js_api=bridge,
        width=1440,
        height=960,
        min_size=(1100, 700),
        background_color='#000000',
        menu=menus
    )
    window_holder['window'] = window

    def handle_window_closed():
        print("\nVentana cerrada. Apagando servidor...")
        request_shutdown(httpd)

    def handle_window_loaded():
        dispatch_frontend_event(window, 'simple3d-native-menu', {'action': 'native-menus-ready'})

    window.events.closed += handle_window_closed
    window.events.loaded += handle_window_loaded
    print(f"Abriendo ventana de escritorio en: {url}")
    webview.start()

def main():
    global server_running, last_heartbeat
    # Cambiar al directorio donde está el script
    os.chdir(os.path.dirname(os.path.abspath(__file__)) or '.')
    server_running = True
    last_heartbeat = time.time() + 5

    port = find_free_port()
    Handler = CustomHandler

    try:
        with ReusableTCPServer(("", port), Handler) as httpd:
            print(f"Servidor iniciado correctamente en el puerto {port}.")
            server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
            server_thread.start()

            # Iniciar el monitor de latidos
            monitor_thread = threading.Thread(target=monitor_heartbeat, args=(httpd,))
            monitor_thread.daemon = True
            monitor_thread.start()

            if webview is not None:
                print("Modo escritorio activo. Cierra la ventana para salir.")
                run_desktop_window(port, httpd)
            else:
                print("No se encontró pywebview. Se abrirá la aplicación en el navegador.")
                print("Presiona Ctrl+C para detener el servidor, o cierra la pestaña del navegador.")
                browser_thread = threading.Thread(target=open_browser, args=(port,), daemon=True)
                browser_thread.start()
                server_thread.join()

    except KeyboardInterrupt:
        print("\nApagando el servidor (Ctrl+C)...")
        server_running = False
    except Exception as e:
        print(f"Error al iniciar el servidor: {e}")
        server_running = False
    finally:
        request_shutdown(httpd) if 'httpd' in locals() else None

if __name__ == "__main__":
    main()
