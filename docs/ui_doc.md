# Documentación de la Interfaz (`index.html` y `style.css`)

## Explicación Sencilla (No Técnica)
Esta es la parte visible de la aplicación. Ahora la interfaz está más limpia y reparte mejor las herramientas:
- Un menú `Archivo` para cargar modelos `OBJ` o `FBX` y para exportar el trabajo.
- Un menú `Edición` para limpiar líneas sueltas, fusionar bloques y abrir `Editar UV`.
- Un menú `Inventario` para elegir qué figura se va a colocar.
- Un panel pequeño arriba a la izquierda que solo aparece para mostrar los FPS cuando están visibles.
- Un panel de control para cambiar entre líneas, bloques con teclado, bloques con ratón, selección de cara y un modo de caras vecinas.
- En `Lineas` aparece un control de `Radio borde` para la herramienta `Crear borde` (menú contextual de líneas).
- Un nuevo tipo de control `Picel` que pinta bloques por matriz y permite elegir tamaño `N` y tipo de traza (`cuadrado`, `circulo` o `rombo`).
- En el modo `Caras vecinas` aparece una caja numérica dentro del propio bloque para indicar cuántos cubos vecinos del mismo plano se suman automáticamente, incluyendo diagonales.
- Un bloque de ayuda aún más pequeño, solo con líneas de texto plano.
- Una pequeña sección de texturas abajo a la izquierda, más compacta, con acceso rápido a cargar, elegir, quitar, desplazar y aplicar una textura. Esa lista ya no se puede ocultar y ahora incluye un ajuste avanzado ocultable para escala y rotación.
- Una ventana modal de `Editar UV` para recolocar la textura sobre la malla del modelo.

## Explicación Técnica
`index.html` define una barra de menús HTML de respaldo para navegador con cuatro grupos, en este orden: `Archivo`, `Edición`, `Inventario` y `Ver`. En escritorio esa barra se oculta cuando la URL incluye `nativeMenus=1`, dejando que `pywebview` enseñe los menús nativos del sistema.

La estructura visual se divide en:
- `#ui-stack`: bloque superior izquierdo con estado y controles frecuentes.
- `#ui-overlay`: caja mínima reservada solo al contador de FPS, oculta por defecto hasta que el usuario activa esa opción.
- `#face-neighbor-controls`: subpanel compacto que solo aparece cuando el radiobutton `Caras vecinas` está activo y deja fijar con una caja numérica el radio de cubos vecinos.
- `#line-border-controls`: subpanel compacto visible solo en modo `Lineas` para ajustar el radio que usa la acción contextual `Crear borde`.
- `#pixel-controls`: subpanel compacto visible solo en modo `Picel` para definir tamaño de matriz y traza del pincel.
- `#bottom-left-tools`: contenedor fijo para la ayuda visual y el panel rápido de texturas, separado del resto para no cargar la columna principal.
- `#texture-modal`: ventana modal para el gestor UV y la lista completa de texturas.
- `#model-import-input`: input oculto reutilizado para seleccionar archivos `.obj` o `.fbx`.
- `#texture-upload-input`: input oculto configurado con una lista amplia de extensiones de imagen (`PNG`, `JPG`, `WEBP`, `AVIF`, `GIF`, `BMP`, `SVG`, `TIFF`, `HEIC`, `TGA`, `PNM` y variantes comunes) además de `image/*`.
- `#project-import-input`: input oculto para cargar proyecto con filtro ampliado (`.s3dc`, `.json`, `application/json`, `text/plain` y fallback `*/*`). En escritorio se prioriza un selector nativo de `pywebview` para mejorar la compatibilidad con `.s3dc`.
- `#quick-texture-transform`: subpanel compacto del acceso rápido con sliders para desplazar la textura seleccionada en `U` y `V`.
- `#quick-texture-advanced`: subpanel oculto junto al transform rápido con sliders de escala y rotación para acercar/alejar la textura (repitiéndola cuando procede) y girarla.

`style.css` mantiene una estética cercana a un software de modelado: superficies gris oscuro, acentos azules y sombras suaves. La simplificación reciente elimina aún más ruido visual, usa bordes rectos en paneles y botones, reduce la ayuda a líneas de texto plano, deja la lista rápida de texturas siempre visible y convierte la zona superior en una caja mínima dedicada solo a FPS.
