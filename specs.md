1. Debo escribir un pequeño resumen en lenguaje no técnico de cada funcionalidad en un fichero md
2. No debo marcar tareas como COMPLETADA de forma autónoma, solo el usuario podrá hacer esto

[COMPLETADA] Crear una aplicacion web que permita crear modelos 3D simples utilizando las flechas del teclado lo cual hará crear puntos uno tras de otro y según dónde mire la cámara cambiarán los controles con las flechas, cuando pulso una flecha del teclado se dibuja una línea desde el último punto hasta el nuevo punto y así con las otras teclas de forma intuitiva y dependiendo de la orientación del modelo las flechas cambiarán

[COMPLETADA] La aplicación web debe poder ejecutarse con un comando de Python que lo que haga sea servir la aplicación web abriendo un navegador automáticamente y ejecutando un servidor local

[COMPLETADA] Si se cierra la pestaña del navegador, el servidor debe cerrarse automáticamente

[COMPLETADA] Cuando se forma una figura o una cara, se tiene que ver dicha cara dibjada en un color gris (estilo Blender)

[COMPLETADA] El color de las líneas y puntos en lugar de ser cyan debe ser naranja (estilo Blender)

[COMPLETADA] Añade un sistema de memoria para poder hacer Ctrl+z y Ctrl+y (hacer y deshacer) pero compatible con Windows y Mac

[COMPLETADA] Las caras a veces no se crean cuando se forma una cara con varios puntos, no es hasta que "repaso" de nuevo toda la cara que es hasta que se crea esta.

[COMPLETADA] Realiza una divisón del código fuente, divide por responsabilidades, y por ficheros según funcionalidad.

[COMPLETADA] Los puntos de las caras se tienen que seguir viendo en naraja pero mucho más pequeños

[COMPLETADA] En lugar de la lista de instrucciones, quiero que en un cuadro pequeño aparezca: el número de caras totales, los vértices totales, los puntos, etc.

[COMPLETADA] Solo visualmente quiero que el modelo 3D tenga un grid en un color gris sutil para dividir solo visualmente en cuadrados el espacio, no quiero que sea un elemento con el que se pueda interactuar, solo visual.

[COMPLETADA] Con el mouse del ratón el puntero quiero que se pueda seleccionar uno de los puntos ya creados del modelo 3D para poder editar desde ese punto, el puntero al pasar sobre uno de los puntos se tiene que marcar en naranja y al hacer click en el punto se tiene que seleccionar.

[COMPLETADA] Añade una funcionalidad para eliminar puntos, que sea seleccionando el punto deseado y pulsando la tecla del o tecla retroceso

[COMPLETADA] Cón un botón activa o desactiva edición por bloques, en lugar de dibujar líneas y puntos con las teclas, que se dibujen cubos directamente y con las flechas crear cubos hacia las mismas direcciones. En este modo se podrán seleccionar con el click izquierdo cubos completos y poder pulsar delete o retroceso para borrar dicho cubo seleccionado.

[COMPLETADA] El botón de tipo de control seran radio buttons, y añade un nuevo control que permita colocar bloques utilizando el ratón (click izquierdo para eliminar bloque y click derecho para colocar bloque) esto es al estilo "Minecraft"

[COMPLETADA] Teniendo seleccionada la opción de utilizar bloques con las flechas del teclado, al pulsar click derecho sobre uno de los cubos tiene que aparecer una opción de "dividir" lo que va a hacer esa opción es poder dividir el cubo en 8 cubos más pequeños y poder editar de forma independiente esos 8 cubos, y lo mismo si quiero dividir un cubo de esos 8 cubos, es decir, que se pueda dividir en 8 cubos más pequeños de forma recursiva.

[COMPLETADA] Añade una opción en los radio button que sea seleccionar cara, y al hacer click sobre una cara aparezca una opción de "Aplicar textura", va a existir una lista de texturas (con previsualización) que se van a poder cargar (o eliminar) y al hacer click sobre aplicar textura teniendo seleccionada una cara del modelo 3D se aplicará la textura a esa cara. 


[COMPLETADA] Añadir una opción "puntos" el cual permita seleccionar uno de los puntos del modelo 3D y con el click izquierdo con la tecla mayusculas sostenida arrastrarlo hacia afuera o hacia adentro

[COMPLETADA] Al tener seleccionada la opción de "puntos" en los radio buttons, al tener seleccionado un o de los puntos disponibles del modelo 3D no permite estirar o contraer su geometría

[COMPLETA] Al momento de dividir un bloque y colocar bloques más pequeños a partir de esa división, no es consistente pues a veces se generan bloques más grandes (bloques con tamaño del padre) en lugar de seguir con los bloques pequeños

[COMPLETADA] Crea funcionalidades de exportar a diferentes formatos con un simple botón "Exportar" y que permita exportar el modelo 3D junto con la textura ya aplicada al modelo 3D a cualquier formato.

[COMPLETADA] Crear una especie de "inventario" el cual lo que haga sea desplegar o contraer un inventario que va a tener diferentes figuras geométricas 3D (esferas, pirámides, cilindros, etc) y que al hacer click sobre una de ellas al momento de querer editar el modelo 3D con cualquiera de los controles disponibles, en lugar de cubos se va a colocar esa figura geométrica seleccionada

[COMPLETADA] Añade una funcionalidad al momento de pulsar click derecho sobre un cubo (o figura geométrica cualquiera) y que aparezca la opción desplazar, lo que me va a permitir mover esa pieza a dónde yo quiera del modelo 3D, evitando el z-fighting al momento de querer fusionar figuras.

[COMPLETADA] Crea una nueva funcionalidad para aplicar una textura al modelo 3D de la misma forma que se hace en Blender, un cuadrado que representa toda la malla del modelo y arrastrando y tirando de la textura aplicandola en el cuadrado que representa la malla ahí se va recolocando la textura, editar UV debe de ser un botón siempre activo, que permita cargar una textura la cual va a servir para una parte del modelo (o el modelo completo) y que se pueda aplicar la textura a toda la malla del modelo de esta misma manera

[COMPLETADA] El botón de editar UV debe desplegar una ventana modal que permita ya si aplicar la textura a la malla del modelo 3D

[COMPLETADA] La ventana modal para aplicar la textura sobre la malla debe tener un editor con un espacio cuadrado que represente la malla del modelo 3D y que permita arrastrar y tirar de la textura aplicandola en el cuadrado que representa la malla ahí se va recolocando la textura, tal y como se puede hacer en programas como Blender, tal y como se muestra en la imagen de ejemplo.

[COMPLETADA] Nuevo botón que permita cambiar el modo de trabajo de todo el programa, por un nuevo modo de creación de modelo 3D que permitirá tener 4 vistas del modelo arriba, derecha izquierda abajo y que permita crear el modelo 3D uniendo puntos para formar caras y caras para formar volumen, y que inteligentemente la app indique al usuario las conexiones entre las caras con las uniones entre puntos y a un lado a la derecha tener una previsualización del modelo 3D completo.


[COMPLETADA] Al unir puntos (botón unir) se tienen que deseleccionar todos los puntos

[COMPLETADA] Debe haber una malla blanca que muestre las líneas entre bloques del modelo 3D

[COMPLETADA] Al tener activo los controles mouse al momento de arrastrar los bloques no se deben colocar ni eliminar, ya que al querer arrastrar por el modelo 3D antes detecta el click del mouse y elimina o coloca un bloque, consigue evitar que eso ocurra.

[COMPLETADA] Al momento de pulsar la tecla shift + rueda del ratón, permite que se pueda cambiar el radiobutton seleccionado, es decir, que se pueda cambiar entre los diferentes modos de control sin necesidad de pulsar el radiobutton correspondiente.

[TAREA] La funcionalidad de desplazar que simplemente se active al hacer click sobre uno de los cubos o figuras movibles del modelo

Consulta la carpeta docs si necesitas información sobre el proyecto

Documenta cada parte del proyecto en una carpeta "docs" que contenga todos los módulos de la aplicación y cada vez que hagas una tarea, actualiza dicha documentación si es necesario. La documentación para cada módulo tiene que tener una explicación sencilla en lenguaje no técnico, y después una explicación técnica de cómo funciona el módulo.
