# Documentación del Gestor de Texturas (`src/textures.js`)

## Explicación Sencilla (No Técnica)
Este módulo se encarga de administrar las imágenes que subes para usarlas como texturas. Agrega un panel a la interfaz donde puedes:
- Pulsar un botón para subir imágenes (por ejemplo `.png` o `.jpg`) desde tu ordenador.
- Ver una pequeña previsualización redonda de las texturas que has cargado en una lista deslizable.
- Seleccionar una de estas texturas (la elegida se resalta con un borde naranja).
- Eliminar una textura de la lista haciendo click en la pequeña "x" roja que aparece al pasar el ratón.
- Aplicar la textura a la cara seleccionada.
- Usar un acceso rapido fuera de la ventana UV con una tira horizontal plegable y un boton directo de "Aplicar textura" para la cara seleccionada.
- Cargar texturas tambien desde ese acceso rapido, sin depender de abrir la ventana UV.
- Aplicar la textura tanto a una parte seleccionada como al modelo completo, segun el alcance elegido.
- Avisar al editor UV qué textura está activa, para que el cuadrado de edición muestre la imagen correcta mientras recolocas la malla.

## Explicación Técnica
El módulo `src/textures.js` expone la fábrica `createTextureManager()` y se comunica mediante *callbacks*.
- **Estado Interno:** Mantiene un arreglo `textures` que almacena objetos con el formato `{ id, url, threeTexture }`. Contiene también `selectedTextureId` para referenciar el ítem activo en la lista de la interfaz de usuario.
- **Carga de Archivos:** Utiliza un input `<input type="file" accept="image/*" style="display: none;">` que se "clica" por programación cuando el botón visible "Cargar Textura" es presionado. Se utiliza `URL.createObjectURL(file)` para generar una URL temporal del archivo en base64 en memoria de forma sincrónica.
- **Three.js `TextureLoader`:** Se carga la URL local de la imagen usando el `THREE.TextureLoader`. Las texturas se preparan como `THREE.SRGBColorSpace` para corregir problemas de color y se les configura el mapeo `THREE.RepeatWrapping`.
- **Limpieza de Memoria:** Cuando se elimina una textura mediante la "x", se invoca `URL.revokeObjectURL(...)` para limpiar la URL del navegador, y `threeTexture.dispose()` para liberar la memoria de GPU ocupada por Three.js, previniendo fugas de memoria, antes de eliminarla del array en JavaScript.
- **Interacción:** El objeto devuelto implementa `show()`, `hide()`, `.onApply(callback)` y `.onSelectionChange(callback)`. En `script.js`, estos eventos se combinan con el alcance elegido por el usuario para aplicar la textura a la parte seleccionada o a toda la malla.
- **Acceso rapido:** Mantiene una segunda lista horizontal sincronizada con la lista principal del modal. Ambas comparten la misma textura seleccionada, y el gestor expone `.onQuickApply(callback)` y `.setQuickApplyAvailable(boolean)` para activar o desactivar la aplicacion directa sobre la cara seleccionada.
- **Carga compartida:** El boton principal y el rapido reutilizan el mismo `<input type="file">`, de modo que cualquier textura subida desde uno de los dos puntos aparece en ambas listas y queda seleccionada inmediatamente.
