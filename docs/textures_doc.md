# Documentación del Gestor de Texturas (`src/textures.js`)

## Explicación Sencilla (No Técnica)
Este módulo guarda las imágenes que subes como texturas y las muestra tanto en la ventana UV como en el pequeño panel rápido de abajo a la izquierda. Permite cargar, seleccionar, borrar y aplicar texturas sin repetir trabajo, deja elegir una lista mucho más amplia de formatos de imagen, deja desplazar la textura con sliders rápidos y ahora incluye una opción fija para quitar la textura.

## Explicación Técnica
`src/textures.js` expone `createTextureManager()` y funciona mediante callbacks.

Detalles principales:
- Mantiene una lista interna de texturas con su `id`, URL temporal y objeto `THREE.Texture`.
- Usa un único `<input type="file">` para cargar imágenes desde el modal o desde el panel rápido.
- Configura ese input con `image/*` más una lista explícita de extensiones frecuentes para no perder formatos que algunos sistemas no muestran bien en el selector: `PNG`, `APNG`, `JPG`, `JPEG`, `JPE`, `JFIF`, `PJPEG`, `PJP`, `WEBP`, `AVIF`, `GIF`, `BMP`, `DIB`, `SVG`, `SVGZ`, `ICO`, `CUR`, `TIF`, `TIFF`, `HEIC`, `HEIF`, `QOI`, `TGA`, `PNM`, `PBM`, `PGM`, `PPM` y `PAM`.
- Sincroniza dos vistas de la misma colección: una cuadrícula en el modal UV y una tira compacta en el acceso rápido.
- Deja el panel rápido siempre abierto para que la lista de texturas quede visible nada más cargar la interfaz.
- Inserta una tarjeta fija `Sin textura` al principio de las listas para poder quitar el mapa de la selección y volver al material base.
- Sincroniza sliders `U` y `V` con la textura seleccionada, actualizando su `offset` y notificando a la capa de selección para refrescar cómo se dibuja donde ya estaba aplicada.
- Expone `onApply(...)` y `onQuickApply(...)` para aplicar la textura al objetivo actual.
- Expone `onSelectionChange(...)` para que el editor UV refresque la imagen activa.
- Expone `onTransformChange(...)` para propagar cambios de desplazamiento de textura.
- Gestiona el estado de disponibilidad del panel rápido con `setQuickApplyAvailable(...)`.
- Libera memoria al eliminar texturas con `texture.dispose()`.

Tras la simplificación visual reciente, el panel rápido usa mensajes más cortos, no se puede contraer, ofrece una casilla fija para quitar la textura y sigue compartiendo exactamente la misma colección de texturas que el modal.
