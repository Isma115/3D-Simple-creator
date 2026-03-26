# Documentación de la Interfaz (`index.html` y `style.css`)

## Explicación Sencilla (No Técnica)
Esta es la "cara" de la aplicación, lo primero que ves cuando abres la página. Consiste en:
- **Un lienzo en blanco** (que en realidad es oscuro) que ocupa toda tu pantalla preparándolo todo para que dibujes.
- **Un texto flotante muy pequeño** en la esquina superior izquierda. Muestra solo las estadísticas del modelo (caras, vértices, puntos y líneas) y las coordenadas actuales, sin título ni caja grande.
- **Un grupo de radio buttons** para elegir el tipo de control (líneas, puntos, bloques con teclado, bloques con ratón o seleccionar cara).
- **Un atajo con `Meta + rueda del raton`** para recorrer esos modos de control sin tocar los radio buttons.
- **Una ventanita flotante en la parte frontal de la pantalla** que aparece al usar ese atajo para decirte qué modo acaba de activarse y desaparece sola al poco tiempo.
- **Un botón para cambiar el modo de trabajo completo**, que activa un espacio de 4 vistas tecnicas para modelar con referencias ortograficas.
- **Un inventario de figuras geométricas** (desplegable) que permite elegir entre Cubo, Esfera, Cilindro, Pirámide y Cono para colocar al usar el modo bloques.
- **Un botón de limpieza** justo debajo, para eliminar líneas que no forman ninguna cara.
- **Una ventana modal del Gestor de Texturas**, que aparece sobre la aplicación cuando pulsas el botón global de "Editar UV". Esa ventana permite cargar, seleccionar, aplicar y borrar texturas.
- **Un botón siempre activo de "Editar UV"**, que abre esa ventana modal aunque no estés en modo seleccionar cara.
- **Un espacio de trabajo UV parecido a Blender**, dentro de la ventana modal. El editor cuadrado ocupa la parte principal y la columna lateral queda para elegir el alcance, cargar texturas y aplicarlas.
- **Un editor UV cuadrado**, dentro del mismo espacio de trabajo. Muestra la imagen cargada como fondo y encima la malla UV de la parte seleccionada o del modelo completo para poder arrastrarla o estirarla visualmente.
- **Un marco visual para el modo 4 vistas**, con cuatro paneles etiquetados (arriba, derecha, izquierda y abajo) y una tarjeta grande de previsualizacion 3D a la derecha.
Este panel está diseñado con un estilo "cristalino", lo que significa que parece un cristal borroso, lo cual le da un toque moderno y tecnológico sin tapar demasiado el dibujo que hay debajo.

## Explicación Técnica

La interfaz de usuario busca ser lo menos intrusiva posible priorizando el espacio del canvas de WebGL (Three.js), manteniendo a su vez una estética premium y moderna.

### Estructura HTML (`index.html`)
- **Documento base:** Utiliza la semántica estándar de HTML5.
- **Fuentes:** Consume la tipografía _Inter_ vía Google Fonts para asegurar modernidad en los textos.
- **Carga de Paquetes:** La aplicación es un módulo ES nativo que no requiere _bundlers_ (como Webpack o Vite) para ejecutarse, ya que utiliza _Import Maps_. Esto permite importar librerías complejas como Three.js directamente en el cliente.
- **Capa UI:** Contiene un contenedor principal `<div id="ui-overlay">` reducido a una lectura compacta de estadísticas y coordenadas en tiempo real. Un contenedor hermano (`#ui-actions`) aloja los radio buttons de control, el boton del modo 4 vistas y el resto de herramientas.
- **Overlay multivista:** Se añadió `#blueprint-workspace`, un contenedor absoluto con paneles transparentes que marcan las cuatro proyecciones y la zona de previsualizacion, sin interceptar los clicks del canvas.

### Estilos (`style.css`)
- **Limpieza (Reset):** `box-sizing: border-box`, eliminación de márgenes y `overflow: hidden` en el `body` previenen barras de desplazamiento no deseadas.
- **Lectura compacta:** El panel superior izquierdo se ha reducido a una pieza de apoyo visual con poco peso, usando un fondo casi transparente, blur suave y tipografia muy pequena para no competir con el canvas.
- **Eventos:** El panel de datos usa `pointer-events: none` para no bloquear los eventos del canvas, mientras el contenedor de acciones (`#ui-actions`) deja el botón interactivo.
- **Panel de acciones:** Se organiza un panel de radio buttons para elegir el control (incluye el modo puntos), botones auxiliares y herramientas de texturizado.
- **Indicador flotante de control:** Se añadió un panel `position: fixed` con transiciones suaves de opacidad y desplazamiento para enseñar el modo activo cuando el usuario usa `Meta + rueda`.
- **Modo 4 vistas:** Los paneles del overlay usan `position: absolute`, fondos translúcidos, rejilla sutil y textos cortos para indicar al usuario en qué proyección está trabajando y en qué plano fijo se encuentra.
- **Panel de estadísticas:** Una unica franja de texto compacto con conteos y coordenadas.
- **Editor UV:** Se añadió un `canvas` cuadrado en `index.html` para representar el espacio UV normalizado de 0 a 1, acompañado de etiquetas de ejes, un estado vacío visible y una distribución en dos columnas para que el editor sea el protagonista de la ventana modal.
