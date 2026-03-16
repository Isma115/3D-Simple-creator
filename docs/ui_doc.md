# Documentación de la Interfaz (`index.html` y `style.css`)

## Explicación Sencilla (No Técnica)
Esta es la "cara" de la aplicación, lo primero que ves cuando abres la página. Consiste en:
- **Un lienzo en blanco** (que en realidad es oscuro) que ocupa toda tu pantalla preparándolo todo para que dibujes.
- **Un panel flotante semitransparente** en la esquina superior izquierda. Este panel sirve como un pequeño manual de instrucciones rápido. Te dice qué teclas usar para dibujar y cómo usar el ratón para rotar tu escultura.
Este panel está diseñado con un estilo "cristalino", lo que significa que parece un cristal borroso, lo cual le da un toque moderno y tecnológico sin tapar demasiado el dibujo que hay debajo.

## Explicación Técnica

La interfaz de usuario busca ser lo menos intrusiva posible priorizando el espacio del canvas de WebGL (Three.js), manteniendo a su vez una estética premium y moderna.

### Estructura HTML (`index.html`)
- **Documento base:** Utiliza la semántica estándar de HTML5.
- **Fuentes:** Consume la tipografía _Inter_ vía Google Fonts para asegurar modernidad en los textos.
- **Carga de Paquetes:** La aplicación es un módulo ES nativo que no requiere _bundlers_ (como Webpack o Vite) para ejecutarse, ya que utiliza _Import Maps_. Esto permite importar librerías complejas como Three.js directamente en el cliente.
- **Capa UI:** Contiene un contenedor principal `<div id="ui-overlay">` que agrupa el título, instrucciones de controles y la visualización de coordenadas en tiempo real.

### Estilos (`style.css`)
- **Limpieza (Reset):** `box-sizing: border-box`, eliminación de márgenes y `overflow: hidden` en el `body` previenen barras de desplazamiento no deseadas.
- **Glassmorphism (Efecto Cristal):** 
  - Al panel UI se le aplica un `backdrop-filter: blur(12px)` soportado nativamente y mediante `-webkit-` pre-fijo.
  - Conjuntamente con un color de fondo `rgba` semitransparente e iluminación de bordes (`border: 1px solid rgba(255, 255, 255, 0.1)`), compone una superficie translúcida sobre el canvas subyacente de Three.js.
  - El contenedor UI aplica `pointer-events: none` para no bloquear los eventos táctiles del ratón que deben ir destinados al `OrbitControls` del canvas 3D.
- **Textos y Degradados:** El texto principal `<h1>` aplica un degradado lineal mediante `background-clip: text` y propiedades de transparencia de texto webkit para lograr un acabado "Ciberpunk".
- **Iconografía CSS:** Pequeños ajustes visuales a las etiquetas `<kbd>` replican el aspecto de las teclas de un teclado mecánico.
