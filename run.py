import http.server
import socketserver
import webbrowser
import threading
import time
import socket
import os
import sys

# Tiempo máximo sin recibir un latido (heartbeat) antes de apagar el servidor
TIMEOUT_SECONDS = 5
last_heartbeat = time.time() + 5 # 5 segundos de gracia adicionales al inicio
server_running = True

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
            print("\nPestaña cerrada. Apagando el servidor...")
            # Apagar asíncronamente para no bloquear la respuesta HTTP
            threading.Thread(target=self.server.shutdown).start()
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
            httpd.shutdown()
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

def main():
    global server_running
    # Cambiar al directorio donde está el script
    os.chdir(os.path.dirname(os.path.abspath(__file__)) or '.')
    
    port = find_free_port()
    Handler = CustomHandler

    try:
        with socketserver.TCPServer(("", port), Handler) as httpd:
            print(f"Servidor iniciado correctamente en el puerto {port}.")
            print("Presiona Ctrl+C para detener el servidor, o cierra la pestaña del navegador.")
            
            # Iniciar el monitor de latidos
            monitor_thread = threading.Thread(target=monitor_heartbeat, args=(httpd,))
            monitor_thread.daemon = True
            monitor_thread.start()

            # Iniciar el navegador en un hilo separado
            browser_thread = threading.Thread(target=open_browser, args=(port,))
            browser_thread.daemon = True
            browser_thread.start()
            
            # Mantener el servidor corriendo hasta que se llame a shutdown()
            httpd.serve_forever()
            server_running = False # Detener el monitor si se apagó por otro medio
            
    except KeyboardInterrupt:
        print("\nApagando el servidor (Ctrl+C)...")
        server_running = False
    except Exception as e:
        print(f"Error al iniciar el servidor: {e}")
        server_running = False

if __name__ == "__main__":
    main()
