# Documentación de Lógica en 3D (`script.js`)

## Explicación Sencilla (No Técnica)
Este archivo es el cerebro visual de nuestra aplicación. Se encarga de tres cosas principales:
1. **Crear el mundo 3D:** Prepara un escenario infinito, coloca una cámara para que podamos observar y añade luces y guías (como una cuadrícula) para que no nos perdamos en el espacio vacío.
2. **Permitirnos movernos:** Usa una herramienta que nos deja girar la cámara, acercarnos y alejarnos usando el ratón, tal cual lo haríamos si estuviéramos inspeccionando un objeto real con las manos.
3. **Dibujar con las flechas:** Aquí está la magia. Cuando pulsas una flecha del teclado, el programa calcula hacia dónde *parece* que estás mirando en ese momento desde la perspectiva de la pantalla, y mueve nuestro "lápiz" en esa misma dirección en el mundo 3D. Luego, traza una línea de neón brillante conectando el punto anterior con el nuevo. 

## Explicación Técnica

El archivo utiliza **Three.js** para renderizar la escena en un elemento `<canvas>` proporcionado por el navegador.

### Inicialización de la escena (`Scene Setup`)
- Se crea una instancia de `THREE.Scene`.
- Se configura un color de fondo oscuro y niebla (`THREE.Fog`) para dar un efecto de desvanecimiento en la distancia.
- Se implementa una `PerspectiveCamera` y el `WebGLRenderer` con `antialias` activado para suavizar los bordes.

### Controles y Entorno (`Controls` & `Guides`)
- Se importa `OrbitControls` para manejar la interacción de la cámara con el ratón. Se le aplica _damping_ (fricción) para suavizar los movimientos inerciales.
- Se añaden `GridHelper` y `AxesHelper` a la escena para proveer referencias espaciales visuales al usuario.

### Lógica de Dibujo y Proyección Relativa (`Drawing Logic`)
1. **Estado:** Mantenemos la posición actual `currentPosition` mediante un `THREE.Vector3`. Un `Mesh` en forma de pequeña esfera sirve como cursor visual.
2. **Proyección del vector de la cámara:**
   - La lógica más compleja se encuentra en el _event listener_ del teclado (`keydown`).
   - Se obtienen los vectores "Derecha" y "Arriba" relativos de la cámara en el espacio del mundo aplicando su cuaternión (`camera.quaternion`) a los vectores base `(1,0,0)` y `(0,1,0)`.
3. **Mapeo a ejes absolutos (`getBestAxis`):**
   - Comparamos el vector de vista de la cámara con los seis ejes absolutos del mundo 3D (`X, -X, Y, -Y, Z, -Z`) usando productos escalares (`dot()`).
   - El eje con el producto escalar más alto (el más alineado a nuestra perspectiva actual) dictará el vector de movimiento real (`moveVector`).
4. **Dibujado:**
   - Se desplaza la posición actual `step` unidades a lo largo de este eje.
   - Se instancia un `THREE.Line` con origen en la posición anterior y destino en la actual usando un `LineBasicMaterial`. El color de la línea transita ligeramente para dar un efecto arcoíris/neon.
5. **Render Loop:** Emplea `requestAnimationFrame` en la función `animate()` para actualizar la pantalla continuamente y responder a rotaciones orbitales.
