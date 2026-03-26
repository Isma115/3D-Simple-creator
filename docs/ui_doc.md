# Documentación de la Interfaz (`index.html` y `style.css`)

## Explicación Sencilla (No Técnica)
Esta es la "cara" de la aplicación, lo primero que ves cuando abres la página. Consiste en:
- **Un lienzo en blanco** (que en realidad es oscuro) que ocupa toda tu pantalla preparándolo todo para que dibujes.
- **Un panel flotante semitransparente** en la esquina superior izquierda. Ahora muestra un cuadro pequeño con estadísticas del modelo (caras, vértices, puntos y líneas) y las coordenadas actuales.
- **Un grupo de radio buttons** para elegir el tipo de control (líneas, puntos, bloques con teclado, bloques con ratón o seleccionar cara).
- **Un atajo con `Ctrl + rueda del raton`** para recorrer esos modos de control sin tocar los radio buttons.
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
- **Capa UI:** Contiene un contenedor principal `<div id="ui-overlay">` que agrupa el título, un panel compacto de estadísticas y la visualización de coordenadas en tiempo real. Un contenedor hermano (`#ui-actions`) aloja los radio buttons de control, el boton del modo 4 vistas y el resto de herramientas.
- **Overlay multivista:** Se añadió `#blueprint-workspace`, un contenedor absoluto con paneles transparentes que marcan las cuatro proyecciones y la zona de previsualizacion, sin interceptar los clicks del canvas.

### Estilos (`style.css`)
- **Limpieza (Reset):** `box-sizing: border-box`, eliminación de márgenes y `overflow: hidden` en el `body` previenen barras de desplazamiento no deseadas.
- **Glassmorphism (Efecto Cristal):** 
  - Al panel UI se le aplica un `backdrop-filter: blur(12px)` soportado nativamente y mediante `-webkit-` pre-fijo.
  - Conjuntamente con un color de fondo `rgba` semitransparente e iluminación de bordes (`border: 1px solid rgba(255, 255, 255, 0.1)`), compone una superficie translúcida sobre el canvas subyacente de Three.js.
  - El panel de datos usa `pointer-events: none` para no bloquear los eventos del canvas, mientras el contenedor de acciones (`#ui-actions`) deja el botón interactivo.
- **Textos y Degradados:** El texto principal `<h1>` aplica un degradado lineal mediante `background-clip: text` y propiedades de transparencia de texto webkit para lograr un acabado "Ciberpunk".
- **Panel de acciones:** Se organiza un panel de radio buttons para elegir el control (incluye el modo puntos), botones auxiliares y herramientas de texturizado.
- **Modo 4 vistas:** Los paneles del overlay usan `position: absolute`, fondos translúcidos, rejilla sutil y textos cortos para indicar al usuario en qué proyección está trabajando y en qué plano fijo se encuentra.
- **Panel de estadísticas:** Un cuadro pequeño con tipografía compacta para mostrar conteos.
- **Editor UV:** Se añadió un `canvas` cuadrado en `index.html` para representar el espacio UV normalizado de 0 a 1, acompañado de etiquetas de ejes, un estado vacío visible y una distribución en dos columnas para que el editor sea el protagonista de la ventana modal.
