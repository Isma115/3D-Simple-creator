# Documentacion de VisorModelos (`VisorModelos/index.html`, `VisorModelos/style.css`, `VisorModelos/script.js`)

## Explicacion Sencilla (No Tecnica)
Este es un programa aparte dentro del proyecto para abrir modelos 3D rapidamente sin entrar al editor principal. Tiene una interfaz limpia, un solo boton para cargar el archivo y una vista 3D con la que puedes girar, mover y acercar el modelo con el raton.

Acepta formatos comunes como `GLB`, `GLTF`, `OBJ`, `FBX`, `STL` y `PLY`.

## Explicacion Tecnica
El subprograma `VisorModelos` esta separado del editor principal y se apoya en Three.js para renderizar modelos importados.

Su frontend se reparte asi:
- `VisorModelos/index.html`: define la barra superior con el boton de carga, el input oculto y el contenedor del canvas.
- `VisorModelos/style.css`: aplica una interfaz oscura, compacta y enfocada en el visor.
- `VisorModelos/script.js`: inicializa escena, camara, renderer y `OrbitControls`, carga distintos formatos mediante loaders oficiales y reencuadra automaticamente el modelo con `Box3`.

Detalles relevantes:
- Usa `GLTFLoader`, `OBJLoader`, `FBXLoader`, `STLLoader` y `PLYLoader`.
- Limpia el modelo anterior antes de cargar uno nuevo y libera su geometria/materiales.
- Reposiciona el modelo en torno al origen para encuadrarlo mejor y recalcula la distancia de la camara en funcion del tamano importado.
- Mantiene una cuadricula sutil y luces basicas para que la lectura del volumen sea clara incluso con modelos sin texturas.
