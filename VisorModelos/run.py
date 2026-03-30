import http.server
import os
import socket
import socketserver
import threading
import time
import webbrowser

try:
    import webview
except ImportError:
    webview = None


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


class SilentHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        return


def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(('', 0))
        return sock.getsockname()[1]


def open_browser(port):
    time.sleep(0.8)
    webbrowser.open(f'http://localhost:{port}')


def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)) or '.')
    port = find_free_port()

    with ReusableTCPServer(('', port), SilentHandler) as httpd:
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()

        url = f'http://localhost:{port}'
        if webview is not None:
            window = webview.create_window(
                'VisorModelos',
                url=url,
                width=1320,
                height=880,
                min_size=(960, 620),
                maximized=True,
                background_color='#171b21'
            )

            def handle_closed():
                threading.Thread(target=httpd.shutdown, daemon=True).start()

            window.events.closed += handle_closed
            webview.start()
            return

        print(f'VisorModelos disponible en {url}')
        browser_thread = threading.Thread(target=open_browser, args=(port,), daemon=True)
        browser_thread.start()
        try:
            thread.join()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
