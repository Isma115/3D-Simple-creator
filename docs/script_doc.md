# Documentacion del Entry Point (`script.js`)

## Explicacion Sencilla (No Tecnica)
Este archivo es el "director de orquesta". No dibuja nada por si mismo, sino que conecta todos los modulos: prepara la escena 3D, crea el estado inicial, conecta el teclado, decide si se trabaja en la vista clasica o en el nuevo modo de 4 vistas, y arranca el renderizado. Su objetivo es que cada parte del sistema trabaje junta sin mezclar responsabilidades.

## Explicacion Tecnica
`script.js` actua como bootstrap del proyecto:
- Importa los modulos de escena, estado, UI, entradas, bloques, control de bloques con raton, menu contextual de bloques, caras, undo/redo, teclado, seleccion, estadisticas, limpieza de lineas y heartbeat.
- Importa tambien el nuevo editor UV visual para la recolocacion de texturas.
- Importa tambien el controlador del nuevo modo de trabajo con 4 vistas ortograficas y una previsualizacion 3D.
- Inicializa `scene`, `camera`, `renderer` y `controls` con `initScene`.
- Crea el estado compartido con `createState` y lo distribuye a los gestores (entries, blocks, graph, faces, undo).
- Registra el punto de origen para que pueda ocultarse cuando una cara lo cubre.
- Conecta el listener de teclado con `attachKeyboardControls` para soportar dibujo normal y modo bloques con teclado.
- Conecta `attachMouseBlockControls` para permitir colocar y borrar cubos con el raton en el modo correspondiente.
- Conecta `attachBlockContextMenu` para permitir dividir cubos con click derecho en el modo de bloques con teclado.
- Conecta el boton de limpieza con `createCleanupManager` para eliminar lineas sin cara.
- Inicia el bucle de animacion con `requestAnimationFrame`.
- En cada actualizacion recalcula los vertices visibles, oculta el cursor naranja en los modos de bloques para no tapar la pieza seleccionada y, cuando el modo de 4 vistas esta activo, fuerza que todos los puntos se mantengan visibles para que el usuario pueda construir el volumen desde las proyecciones.
- Conecta los radio buttons del tipo de control para alternar entre dibujo normal, modo puntos, bloques con teclado o bloques con raton y limpiar selecciones.
- Conecta un boton de cambio global de modo de trabajo para entrar o salir del flujo de modelado por 4 vistas.
- En el bucle de animacion decide si renderiza una sola vista perspectiva o si delega el render en el controlador multivista.
- Mantiene sincronizados el gestor de texturas, el alcance UV elegido por el usuario y el editor UV mediante una funcion auxiliar que refresca las herramientas de texturizado segun el contexto.
- El boton global "Editar UV" abre una ventana modal de texturas y, si ya existe un objetivo valido, abre tambien la sesion UV correspondiente sobre una parte seleccionada o sobre toda la malla.
- Arranca el envio de heartbeats para el cierre automatico del servidor.

Este archivo queda deliberadamente pequeno y declarativo para evitar que la logica principal vuelva a mezclarse en un solo bloque.
