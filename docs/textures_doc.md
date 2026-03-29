# Documentación del Gestor de Texturas (`src/textures.js`)

## Explicación Sencilla (No Técnica)
Este módulo guarda las imágenes que subes como texturas y las muestra tanto en la ventana UV como en el pequeño panel rápido de abajo a la izquierda. Permite cargar, seleccionar, borrar y aplicar texturas sin repetir trabajo, y ahora deja elegir una lista mucho más amplia de formatos de imagen.

## Explicación Técnica
`src/textures.js` expone `createTextureManager()` y funciona mediante callbacks.

Detalles principales:
- Mantiene una lista interna de texturas con su `id`, URL temporal y objeto `THREE.Texture`.
- Usa un único `<input type="file">` para cargar imágenes desde el modal o desde el panel rápido.
- Configura ese input con `image/*` más una lista explícita de extensiones frecuentes para no perder formatos que algunos sistemas no muestran bien en el selector: `PNG`, `APNG`, `JPG`, `JPEG`, `JPE`, `JFIF`, `PJPEG`, `PJP`, `WEBP`, `AVIF`, `GIF`, `BMP`, `DIB`, `SVG`, `SVGZ`, `ICO`, `CUR`, `TIF`, `TIFF`, `HEIC`, `HEIF`, `QOI`, `TGA`, `PNM`, `PBM`, `PGM`, `PPM` y `PAM`.
- Sincroniza dos vistas de la misma colección: una cuadrícula en el modal UV y una tira compacta en el acceso rápido.
- Expone `onApply(...)` y `onQuickApply(...)` para aplicar la textura al objetivo actual.
- Expone `onSelectionChange(...)` para que el editor UV refresque la imagen activa.
- Gestiona el estado de disponibilidad del panel rápido con `setQuickApplyAvailable(...)`.
- Libera memoria al eliminar texturas con `texture.dispose()`.

Tras la simplificación visual reciente, el panel rápido usa mensajes más cortos y un diseño más compacto, pero sigue compartiendo exactamente la misma colección de texturas que el modal.
