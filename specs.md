No debo marcar tareas como COMPLETADA de forma autónoma, solo el usuario podrá hacer esto

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

[COMPLETADA] La funcionalidad de desplazar que simplemente se active al hacer click sobre uno de los cubos o figuras movibles del modelo

[COMPLETADA] "Tipo de control" tiene que aparecer en frente de la pantalla como ventanita flotante al momento de hacer Ctrl+rueda del ratón hacia arriba o abajo (por cierto, ahora mismo no funciona correctamente no cambia el tipo de control) y que permita cambiar entre los diferentes modos de control sin necesidad de pulsar el radiobutton correspondiente, esta ventanita tiene que mostrarse al momento de detectar un cambio y debe ocultarse un segundo y medio después

[COMPLETADA] Quiero que los controles de mover figura o cubo se activen no con un solo click sino con doble click

[COMPLETADA] Quita la opción de esculpir y todo lo que tenga que ver con esculpir, ya que quiero que el programa no necesite esta funcionalidad, pues todo va a ser low poly

[COMPLETADA] Corrige el editar UV ya que el texturizado lo hace al revés, en lugar de arrastrar la textura sobre el modelo 3D lo que hace es arrastrarse el propio modelo 3D, tiene que ser al revés

[COMPLETADA] Permite que teniendo seleccionada una cara del modelo 3D se pueda aplicar una textura a dicha cara, teniendo un botón de rápido acceso "Aplicar textura" teniendo la textura cargada en un contenedor que va a contener toda la lista de texturas, de forma horizontal, y un panel que va a permitir desplegar dicha lista de texturas u ocultarlas

[COMPLETADA] El modo de control línea tiene que permitir crear puntos nuevos haciendo click sobre uno de los puntos del modelo y se creará una previsualización de una línea naranja 

[COMPLETADA] Consigue que el software se ejecute como una ventana de aplicación de escritorio para no tener que depender del navegador

[COMPLETADA] Quitar el contador de vértices, caras, puntos etc

[COMPLETADA] Las líneas sin caras se tienen que eliminar automáticamente antes de exportar el modelo

[COMPLETADA] Agrega la posibilidad de en lugar de usar las flechas del teclado se utilicen las teclas WASD

[COMPLETADA] El inventario de figuras llevalo a la barra de menú superior de la aplicación "Inventario"

[COMPLETADA] El botón Eliminar líneas sin cara llevalo a como opción a un menú "Edición"

[COMPLETADA] El botón de fusionar bloques o fusionar selección llevalo al mismo botón Edición

[COMPLETADA] El menú de inventario y edición, deben ser menús nativos de las ventanas

[COMPLETADA] Añadir un texto que muestre los FPS (se podrá ocultar o mostrar en el menú Ver -> Mostrar FPS)

[COMPLETADA] Eliminar la funcionalidad de poder ver los vértices 

[COMPLETADA] Cambia el aspecto visual de los componentes visuales para que se parezca más a la interfaz de Blender, pero que tampoco sea exactamente igual

[COMPLETADA] La sección de cargar texturas dejala en un pequeño espacio abajo a la izquierda de la interfaz, y simplifica más como se ve

[COMPLETADA] La opción de editar UV muévela al menú Edición

[COMPLETADA] Elimina el modo 4 vistas y toda su funcionalidad

[COMPLETADA] El menú de Exportar muévelo a un menú "Archivo"

[COMPLETADA] Añade opciones en Archivo para cargar un modelo obj o fbx

[COMPLETADA] Por defecto tiene que estar seleccionado el modo colocar bloques con el teclado

[COMPLETADA] Colocar bloques con el click derecho en modo ratón no funciona ya

[COMPLETADA] Simplifica más los textos de instrucciones de control, utilizando menos texto y símbolos para que se vea más limpio

[COMPLETADA] Añade un control para que si pulso Ctrl+D teniendo el ratón sobre algún cubo, quiero que este se divida

[COMPLETADA] Si se tienen varios cubos seleccionados y pulso en "Dividir" o directamente hago Ctrl+d quiero que todos los cubos seleccionados se dividan, lo mismo para cuando pulso en borrar (tecla de retroceso o suprimir), y si se hacen otras funciones con ratón o teclado sobre cubos o figuras que funcione de la misma manera

[COMPLETADA] Al cargar la app la ventana que contiene la aplicación estará en blanco, esto fulmina a la vista, quiero que sea negra en lugar de blanca

[COMPLETADA] Al arrastrar, los bloques o figuras seleccionadas no se deben deseleccionar, solamente al pulsar click izquierdo en cualquier sitio, que si que se deseleccionen

[COMPLETADA] El atajo de Ctrl+d debe aplicarse al bloque el cual el mouse está posado encima en lugar del bloque seleccionado con click izquierdo

[COMPLETADA] Funcionalidad para guardar o cargar un modelo 3D el cual se está editando, para poder retomar el trabajo más tarde

[COMPLETADA] Elimina el botón de deseleccionar puntos, quiero que esta función se ejecute automáticamente al momento de hacer click izquierdo en cualquier parte de la app (la función de arrastrar no debe deseleccionar los puntos)

[COMPLETADA] Parece que no todos los tipos de archivos de imagen son permitidos para importar, lista todos los posibles formatos de imagen y haz que se pueda importar texturas de cualquier formato de imagen

[COMPLETADA] Elimina el tipo de control "Puntos"

[COMPLETADA] El formato que utiliza blender para mostrar las instrucciones de uso de la app incluye imágenes para mostrar cada control, quiero que hagas lo mismo, que muestres imágenes de los controles en lugar de texto, o si no puedes crear iconos svg o imágenes pues utiliza emojis

[COMPLETADA] Reordena los menús superiores, el primero que tiene que aparecer es Archivo, al lado del de Editar

[COMPLETADA] Simplifica más la interfaz gráfica pero que tampoco sea demasiado simple, bordes cuadrados en lugar de redondeados

[COMPLETADA] La opción de Mostrar u ocultar ayuda no funciona

[COMPLETADA] Añade un tipo de control que permita seleccionar caras individuales de cada cubo, cuando esta opción esté seleccionada se van a desplegar dentro de ese radiobutton un parámetro (caras vecinas) que va a permitir al momento de pulsar sobre una cara del cubo, se van a seleccionar automáticamente la n caras vecinas que estén en contacto con la cara seleccionada.

[COMPLETADA] El control de selección de caras individuales tiene que permitir seleccionar varias caras a la vez manteniendo pulsado el shift

[COMPLETADA] Simplifica aún más el como se muestran las instrucciones solo con puro texto plano ocupando menos espacio

[COMPLETADA] La lista de texturas cargadas por defecto tiene que estar mostrando las texturas

[COMPLETADA] Que la combinación para cambiar el tipo de control utilice la tecla Ctrl + rueda, en lugar del control que hay ahora

[COMPLETADA] En la sección de texturas quiero un slider que permita desplazar la textura y como se dibuja en las caras en las cuales se ha decidido dibujar

[COMPLETADA] Fusionar selección teniendo varios bloques seleccionados no permite fusionar los bloques, corrige este error

[COMPLETADA] Al pular click derecho al tener seleccionados varios bloques permite que se puedan fusionar con una nueva opción "Fusionar selección" en la ventana flotante

[COMPLETADA] Al guardar el modelo 3D el cual se está editando (Modo guardar trabajo) quiero que también se guarden las texturas cargadas y que se vuelven a cargar automáticamente al momento de volver a abrir el proyecto

[COMPLETADA] Al momento de iniciar la app quiero que se inicie en modo ventana pero que ocupe toda la pantalla disponible

[COMPLETADA] En la sección de información deja solamente el contador de FPS en caso de que este esté activado

[COMPLETADA] La lista de texturas cargadas solo puede estar abierta, no debe poder ocultarse

[COMPLETADA] Añade un nuevo control a los bloques o figuras que sea redimensionar, que permita cambiar el control de mover el bloque o figura para que pase a -> redimensionar y que haciendo lo mismo que la función de mover permita ampliar o reducir el tamaño del bloque o figura

[COMPLETADA] Añade un espacio por defecto al cargador de texturas para eliminar la textura y dejar la textura por defecto de la figura o cubo

[COMPLETADA] La funcionalidad de caras vecinas no recoge solamente una cara de la figura, sino que si por ejemplo tengo un bloque conjunto (fusionado), va a seleccionar todas sus caras, quiero que solo seleccione la cara en la que se ha pulsado

[TAREA] Construye un programa dentro de este mismo directorio (VisorModelos) que permita visualizar modelos de cualquier formato obj, fbx, glb, etc. que tenga una interfaz sencilla y limpia, con un botón para cargar el modelo.

[TAREA] Al momento de tener seleccionada alguna figura o cara, etc, no se puede deseleccionar cuando arrastro por la pantalla, solamente al pulsar click izquierdo en cualquier sitio ya si se deseleccionará.





[TAREA] La función de redimensionar tiene que activar en la figura seleccionada la misma función que la de mover, pero en lugar de flechas en cada eje serán cubitos (como en blender cuando se quiere redimensionar un bloque) y puedes tirar sobre cada uno de los ejes para amplair la figura, y también tiene que haber un cubito en el centro que permita ampliar o reducir el tamaño de la figura en todos los ejes a la vez.



Consulta la carpeta docs si necesitas información sobre el proyecto

Documenta cada parte del proyecto en una carpeta "docs" que contenga todos los módulos de la aplicación y cada vez que hagas una tarea, actualiza dicha documentación si es necesario. La documentación para cada módulo tiene que tener una explicación sencilla en lenguaje no técnico, y después una explicación técnica de cómo funciona el módulo.
