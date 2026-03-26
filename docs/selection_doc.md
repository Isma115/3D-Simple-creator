# Documentacion de Seleccion (`src/selection.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo permite elegir con el raton un punto, un cubo del modelo, o una cara segun el modo activo. Al pasar el cursor por encima, el elemento se marca en naranja o gris. En modo bloques con teclado, al hacer click se selecciona para seguir dibujando desde ahi o borrarlo con el teclado. Si estás en modo seleccionar cara, la previsualizacion muestra exactamente la cara bajo el cursor en verde claro y, al hacer click, esa cara queda marcada con un verde mas intenso para poder aplicar texturas o abrir el editor UV solo para esa parte. Si haces click izquierdo en otro sitio sin seleccionar otra cara, la seleccion se limpia. En modo puntos puedes seleccionar un vertice y, manteniendo mayusculas, arrastrarlo hacia afuera o hacia adentro del modelo. Si no hay un punto existente (modo normal), puedes pasar por la rejilla del plano y se marcara un punto intermedio para poder seleccionar esa posicion aunque no exista como vertice del modelo. Cuando el programa entra en el nuevo modo de 4 vistas, este modulo deja de capturar el raton para no competir con la edicion ortografica.

## Explicacion Tecnica
`src/selection.js` usa `Raycaster` de Three.js sobre las esferas de puntos o los cubos y caras 2D, dependiendo de `state.controlMode`, y controla el estado de hover/seleccion. El punto seleccionado se guarda en `state.selectedEntry` y el punto bajo el cursor en `state.hoveredEntry`. Para cubos usa `state.selectedBlock` y `state.hoveredBlock`, y para texturizar almacena `state.hoveredFace` y `state.selectedFace`.

Cuando `state.workMode` deja de ser `classic`, sus listeners salen pronto, limpian previews y dejan el control del raton al nuevo modulo `workspace_mode`, evitando conflictos entre clicks 3D y clicks sobre las vistas ortograficas.

Ademas, cuando el usuario usa la accion contextual `Unir`, el modulo enlaza los puntos consecutivos seleccionados y despues limpia toda la seleccion para dejar el lienzo listo para la siguiente operacion sin puntos marcados.

En modo puntos habilita un arrastre con mayusculas que desplaza el vertice a lo largo del eje dominante de la camara, actualizando su posicion y las lineas conectadas (no mueve puntos que vienen de bloques).

Para la nueva edicion tipo Blender:
- **Aplicacion de textura:** al aplicar una textura a la cara seleccionada, el modulo clona la textura y el material correspondiente para no contaminar otras piezas.
- **Conservacion del ajuste UV:** si la pieza ya estaba texturizada y el usuario habia recolocado la textura en el editor UV, al aplicar otra textura mantiene esa colocacion en vez de reiniciar el encaje.
- **Previsualizacion de caras:** en modo seleccionar cara crea overlays geometricos encima de la cara real para que tanto el hover como la seleccion se dibujen exactamente sobre la superficie correcta, incluso en bloques texturizados o caras compuestas.
- **Cara conjunta precisa:** cuando esta activa la opcion de cara conjunta en bloques, busca una superficie rectangular continua alrededor de la cara pulsada. Ya no une formas en L, en T o zonas separadas solo por pertenecer al mismo plano general.
- **Dos tipos de seleccion conjunta:** el usuario puede elegir entre el tipo 1, que recupera la seleccion conectada anterior, y el tipo 2, que es el comportamiento actual y viene activado por defecto para limitar la seleccion a un rectangulo continuo.
- **Color de estado:** usa verde claro semitransparente para la previsualizacion y un verde mas contrastado para la cara ya seleccionada.
- **Deseleccion al hacer click fuera:** ignora los clicks que vienen de un arrastre de camara, pero si el usuario hace click izquierdo en vacio sin arrastrar, limpia la seleccion de cara actual.
- **UVs reales:** cuando la seleccion es editable, crea una geometria propia para la malla afectada si antes estaba compartida, asegura que exista el atributo `uv` y escribe coordenadas UV sobre la geometria, en vez de limitarse a offsets visuales de la textura.
- **Sesion UV:** expone metodos para construir sesiones UV tanto de la parte seleccionada como de toda la malla del modelo, para que `script.js` pueda abrir el editor visual con los puntos UV y los triangulos del alcance actual.
- **Modelo completo:** cuando el alcance es global, recopila caras planas, caras libres y bloques activos para tratarlos como una sola edicion UV sobre el modelo entero.
- **Reencaje automatico:** puede recalcular un encaje UV inicial proyectando la seleccion al plano de la cara o de la malla, lo que hace que una pared de cubos conjunta se comporte como una sola isla UV dentro del cuadrado del editor.
