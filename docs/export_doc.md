# Exportar Modelo (export.js)

## Explicación Sencilla
Este módulo permite guardar el modelo 3D que has creado. Coge todos los cubos y caras dibujadas, eliminando de paso los elementos visuales que te ayudan a dibujar (como las líneas guía, las redículas o el puntero de edición) y lo empaqueta en un archivo que puedes descargar a tu ordenador. 
Antes de exportar, el programa limpia automáticamente las líneas sueltas que no pertenecen a ninguna cara para que el archivo final salga más limpio.
Cuando hay cubos normales pegados entre si, intenta juntarlos en bloques más grandes antes de exportar para no sacar una malla inflada con piezas duplicadas por dentro.
Soporta dos formatos:
- formato **.glb / .gltf**: Es el formato más moderno e ideal porque guarda la forma del modelo y *también las texturas* que le hayas aplicado a las distintas caras en un solo archivo interno.
- formato **.zip (para .obj)**: Es un formato más antiguo y extendido. Dado que el formato `.obj` base no soporta incrustar texturas en el mismo fichero, al exportar en este modo la aplicación dibuja las texturas, ensambla un `.mtl` (archivo de materiales de OBJ), lo junta todo con el propio `.obj` en un fichero `.zip` y lo descarga a tu ordenador. ¡Así tienes la malla limpia y sus texturas emparejadas!

## Explicación Técnica
El módulo `export.js` se encarga de aislar la geometría creada por el usuario (ignorando los helpers y líneas internas) clonando las mallas desde las caras libres (`state.looseFaceMeshes`) y los bloques activos (`blockManager.getBlockEntries()`) para añadirlos a un `THREE.Group` temporal.

La limpieza de líneas sin cara se dispara desde `script.js` justo antes de llamar a `exportGLTF(...)` o `exportOBJ(...)`, reutilizando el mismo `cleanupManager` que existe para la acción manual de edición. Así el archivo exportado no conserva segmentos auxiliares aunque el usuario no haya pulsado antes la limpieza manual.

Antes de exportar los bloques:
- elimina los hijos `Line` / `LineSegments` para que la malla blanca de contorno no termine dentro del archivo exportado.
- detecta cubos simples adyacentes con el mismo tamaño y material base y reconstruye su piel exterior exacta, fusionando caras coplanares visibles y eliminando las internas sin cambiar la forma real del modelo.
- deja fuera de esa fusion automatica a los prismas rectangulares ya compactados en el editor, exportandolos tal cual con su escala real para no deformar la geometria.
- indexa la geometria resultante para reutilizar vertices equivalentes en vez de duplicarlos por cada triangulo.
- deja sin fusionar las figuras no cúbicas o los cubos con materiales complejos por cara para no romper texturas ni UV.

Se vale de exportadores provistos por Three.js mediante sus módulos *addons* oficiales y JSZip:
- `GLTFExporter` (`three/addons/exporters/GLTFExporter.js`): Convierte la agrupación a un formato binario `.glb`, lo cual preserva de manera eficiente las primitivas, colores (materiales) y **texturas de imagen**, resultando en un único archivo autocontenido.
- `OBJExporter` (`three/addons/exporters/OBJExporter.js`) + **Generador MTL + JSZip**: El exportador oficial de OBJ de Three.js genera la malla en texto. El módulo `export.js` recorre la malla posteriormente recolectando todos sus materiales. Luego genera el texto gramatical de un fichero `.mtl` dinámico para mapear cada material y dibuja la textura de la imagen original en un `canvas` temporal que es transformado a formato `.png`. Finalmente, la biblioteca `jszip` recoge todos estos archivos (mesh.obj, materiales.mtl, imágenes.png) generados en memoria y los comprime en un fichero `.zip`.

El proceso de descarga se realiza mediante la API nativa del navegador para los Blobs: se instancia un `Blob` a partir de la salida proporcionada por los analizadores gramaticales (parsers), se genera una URL temporal usando `URL.createObjectURL(blob)`, y luego se dispara de form programática un click en un elemento `<a>` ficticio. Este elemento tiene seteado el atributo `download` para que el navegador ofrezca automáticamente la pantalla de descarga.
