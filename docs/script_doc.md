# Documentacion del Entry Point (`script.js`)

## Explicacion Sencilla (No Tecnica)
Este archivo es el "director de orquesta". No dibuja nada por si mismo, sino que conecta todos los modulos: prepara la escena 3D, crea el estado inicial, conecta el teclado, y arranca el renderizado. Su objetivo es que cada parte del sistema trabaje junta sin mezclar responsabilidades.

## Explicacion Tecnica
`script.js` actua como bootstrap del proyecto:
- Importa los modulos de escena, estado, UI, entradas, bloques, control de bloques con raton, menu contextual de bloques, caras, undo/redo, teclado, seleccion, estadisticas, limpieza de lineas y heartbeat.
- Inicializa `scene`, `camera`, `renderer` y `controls` con `initScene`.
- Crea el estado compartido con `createState` y lo distribuye a los gestores (entries, blocks, graph, faces, undo).
- Registra el punto de origen para que pueda ocultarse cuando una cara lo cubre.
- Conecta el listener de teclado con `attachKeyboardControls` para soportar dibujo normal y modo bloques con teclado.
- Conecta `attachMouseBlockControls` para permitir colocar y borrar cubos con el raton en el modo correspondiente.
- Conecta `attachBlockContextMenu` para permitir dividir cubos con click derecho en el modo de bloques con teclado.
- Conecta el boton de limpieza con `createCleanupManager` para eliminar lineas sin cara.
- Inicia el bucle de animacion con `requestAnimationFrame`.
- En cada actualizacion recalcula los vertices visibles y puede ocultar los puntos para dejar solo la rejilla visual.
- Conecta los radio buttons del tipo de control para alternar entre dibujo normal, modo puntos, bloques con teclado o bloques con raton y limpiar selecciones.
- Arranca el envio de heartbeats para el cierre automatico del servidor.

Este archivo queda deliberadamente pequeno y declarativo para evitar que la logica principal vuelva a mezclarse en un solo bloque.
