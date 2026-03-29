# Documentación de la Interfaz (`index.html` y `style.css`)

## Explicación Sencilla (No Técnica)
Esta es la parte visible de la aplicación. Ahora la interfaz está más limpia y reparte mejor las herramientas:
- Un menú `Archivo` para cargar modelos `OBJ` o `FBX` y para exportar el trabajo.
- Un menú `Edición` para limpiar líneas sueltas, fusionar bloques y abrir `Editar UV`.
- Un menú `Inventario` para elegir qué figura se va a colocar.
- Un panel pequeño arriba a la izquierda con la posición actual, la figura activa y los FPS cuando están visibles.
- Un panel de control para cambiar entre líneas, bloques con teclado, bloques con ratón y selección de cara.
- Un bloque de ayuda visual compacto con etiquetas cortas como `LMB`, `RMB` o `CMD` para recordar los controles sin llenar la pantalla de texto.
- Una pequeña sección de texturas abajo a la izquierda, más compacta, con acceso rápido a cargar, elegir y aplicar una textura.
- Una ventana modal de `Editar UV` para recolocar la textura sobre la malla del modelo.

## Explicación Técnica
`index.html` define una barra de menús HTML de respaldo para navegador con cuatro grupos, en este orden: `Archivo`, `Edición`, `Inventario` y `Ver`. En escritorio esa barra se oculta cuando la URL incluye `nativeMenus=1`, dejando que `pywebview` enseñe los menús nativos del sistema.

La estructura visual se divide en:
- `#ui-stack`: bloque superior izquierdo con estado y controles frecuentes.
- `#bottom-left-tools`: contenedor fijo para la ayuda visual y el panel rápido de texturas, separado del resto para no cargar la columna principal.
- `#texture-modal`: ventana modal para el gestor UV y la lista completa de texturas.
- `#model-import-input`: input oculto reutilizado para seleccionar archivos `.obj` o `.fbx`.
- `#texture-upload-input`: input oculto configurado con una lista amplia de extensiones de imagen (`PNG`, `JPG`, `WEBP`, `AVIF`, `GIF`, `BMP`, `SVG`, `TIFF`, `HEIC`, `TGA`, `PNM` y variantes comunes) además de `image/*`.

`style.css` mantiene una estética cercana a un software de modelado: superficies gris oscuro, acentos naranjas y sombras suaves. La simplificación reciente elimina aún más ruido visual, usa bordes rectos en paneles y botones y compacta la ayuda en tarjetas pequeñas con códigos de entrada breves.
