# Documentacion de Ejecucion de VisorModelos (`VisorModelos/run.py`)

## Explicacion Sencilla (No Tecnica)
Este archivo abre el visor como una pequena aplicacion independiente. Levanta un servidor local para mostrar los archivos del visor y, si el sistema lo permite, abre una ventana nativa maximizada.

## Explicacion Tecnica
`VisorModelos/run.py` reutiliza el mismo enfoque general del proyecto principal, pero en una version mas ligera:
- Cambia el directorio actual a `VisorModelos/` para servir sus archivos directamente.
- Busca un puerto libre automaticamente.
- Inicia un `http.server` silencioso para no ensuciar la consola.
- Si `pywebview` esta disponible, abre una ventana nativa maximizada con fondo oscuro.
- Si `pywebview` no existe, abre el visor en el navegador como modo de respaldo.

No necesita menus nativos ni puente JS porque toda la interaccion del visor se resuelve con un unico boton de carga dentro de la propia interfaz.
