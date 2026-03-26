# Documentacion del Editor UV (`src/uv_editor.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo muestra un cuadrado que representa el espacio completo de la textura, parecido al editor UV de Blender pero simplificado. Dentro de ese cuadrado dibuja la forma de la malla seleccionada y te deja:
- Mover la malla UV arrastrando dentro del recuadro.
- Estirarla o comprimirla tirando de las esquinas.
- Reencajarla con un boton para volver a colocarla ocupando el cuadrado de forma automatica.
- Trabajar con solo una parte elegida del modelo o con toda la malla, segun el alcance seleccionado en la interfaz.
- Mantener siempre visible el espacio cuadrado del editor dentro de la ventana modal, incluso si todavia no hay una textura cargada.

## Explicacion Tecnica
`src/uv_editor.js` crea una interfaz basada en `<canvas>` y expone `createUvEditor()`. Esta interfaz vive dentro de la ventana modal de texturas.

El objeto resultante ofrece:
- `show(session)` para abrir el panel con una sesion UV entregada por `selection.js`.
- `hide()` para ocultarlo y limpiar el estado local.
- `isVisible()` para que `script.js` sepa si debe refrescar el panel cuando cambia la seleccion o la textura activa.

Internamente:
- Calcula un viewport cuadrado dentro del canvas y pinta un tablero base mas la imagen de la textura como fondo.
- Dibuja la isla UV mediante los triangulos que recibe en la sesion, no solo una caja abstracta, para que la forma real de la malla sea visible.
- Detecta si el puntero cae dentro del rectangulo de la isla o sobre una esquina, cambiando entre modo mover y modo escalar.
- Mantiene visible el lienzo aunque no haya sesion UV activa, mostrando un estado vacio centrado para que la modal siga funcionando como un editor y no como un simple formulario.
- En cada arrastre llama a `session.update(...)`, que es quien escribe las nuevas coordenadas UV reales sobre la geometria seleccionada o sobre toda la malla, segun el alcance activo.
