# Documentación del Gestor de Texturas (`src/textures.js`)

## Explicación Sencilla (No Técnica)
Este módulo se encarga de administrar las imágenes que subes para usarlas como texturas. Agrega un panel a la interfaz donde puedes:
- Pulsar un botón para subir imágenes (por ejemplo `.png` o `.jpg`) desde tu ordenador.
- Ver una pequeña previsualización redonda de las texturas que has cargado en una lista deslizable.
- Seleccionar una de estas texturas (la elegida se resalta con un borde naranja).
- Eliminar una textura de la lista haciendo click en la pequeña "x" roja que aparece al pasar el ratón.
- Finalmente, si tienes una cara del modelo 3D seleccionada, podrás pulsar el botón "Aplicar Textura" para pintar esa cara con la textura seleccionada.

## Explicación Técnica
El módulo `src/textures.js` expone la fábrica `createTextureManager()` y no tiene dependencias cruzadas complejas, comunicándose mediante *callbacks*.
- **Estado Interno:** Mantiene un arreglo `textures` que almacena objetos con el formato `{ id, url, threeTexture }`. Contiene también `selectedTextureId` para referenciar el ítem activo en la lista de la interfaz de usuario.
- **Carga de Archivos:** Utiliza un input `<input type="file" accept="image/*" style="display: none;">` que se "clica" por programación cuando el botón visible "Cargar Textura" es presionado. Se utiliza `URL.createObjectURL(file)` para generar una URL temporal del archivo en base64 en memoria de forma sincrónica.
- **Three.js `TextureLoader`:** Se carga la URL local de la imagen usando el `THREE.TextureLoader`. Las texturas se preparan como `THREE.SRGBColorSpace` para corregir problemas de color y se les configura el mapeo `THREE.RepeatWrapping`.
- **Limpieza de Memoria:** Cuando se elimina una textura mediante la "x", se invoca `URL.revokeObjectURL(...)` para limpiar la URL del navegador, y `threeTexture.dispose()` para liberar la memoria de GPU ocupada por Three.js, previniendo fugas de memoria, antes de eliminarla del array en JavaScript.
- **Interacción:** El objeto devuelto implementa `show()`, `hide()` y un evento `.onApply(callback)`. En `script.js` este *callback* se conecta a `selectionManager.applyTextureToSelected(texture)`, pasándole la textura directamente desde el array interno.
