# Documentacion del Editor UV (`src/uv_editor.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo muestra un cuadrado que representa el espacio completo de la textura, parecido al editor UV de Blender pero simplificado. Dentro de ese cuadrado dibuja la forma de la malla seleccionada y te deja:
- Mover la textura por debajo de la malla arrastrando dentro del recuadro.
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
- Calcula un viewport cuadrado dentro del canvas y pinta un tablero base mas la imagen de la textura repetida dentro del area visible.
- Dibuja la isla UV mediante los triangulos que recibe en la sesion, no solo una caja abstracta, para que la forma real de la malla quede fija y visible mientras la textura se desplaza por debajo.
- Detecta si el puntero cae dentro del rectangulo de la isla o sobre una esquina, cambiando entre mover la textura o escalarla respecto a la esquina opuesta.
- Mantiene visible el lienzo aunque no haya sesion UV activa, mostrando un estado vacio centrado para que la modal siga funcionando como un editor y no como un simple formulario.
- En cada arrastre mantiene la silueta UV fija en pantalla, recalcula las coordenadas UV reales con una transformacion afín y llama a `session.update(...)` para escribirlas sobre la geometria seleccionada o sobre toda la malla, segun el alcance activo.
