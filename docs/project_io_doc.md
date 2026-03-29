# Documentación de Proyectos (`src/project_io.js`)

## Explicación Sencilla (No Técnica)
Este módulo permite guardar el trabajo en un archivo propio del programa y volver a abrirlo más tarde. No solo guarda la forma del modelo: también conserva texturas, UV, líneas, caras y piezas para que puedas seguir editándolo justo donde lo dejaste.

## Explicación Técnica
`src/project_io.js` expone `createProjectIO(...)`.

Su responsabilidad es:
- Recoger el estado editable de la escena y convertirlo en un JSON de proyecto `.s3dc`.
- Guardar bloques, caras de plano, caras libres, líneas, puntos relevantes, texturas cargadas y parte del estado de sesión.
- Serializar geometrías, materiales y mapas de textura cuando hace falta, incluyendo UV editadas.
- Reutilizar el diálogo nativo de escritorio cuando `pywebview` está disponible, o la descarga del navegador en modo web.
- Vaciar el modelo actual antes de cargar uno guardado, usando el mismo limpiado base que ya usaba la importación.
- Reconstruir la escena llamando a los managers existentes (`blockManager`, `faceController`, `entryManager`, `graphManager`, `textureManager`) para que el resultado siga siendo editable y no quede como una malla pasiva.
- Normalizar estados heredados del editor, como proyectos antiguos que aún guardaban el control `points`, para devolverlos al flujo actual sin romper la carga.

El formato se ha planteado como snapshot del editor, no como exportación de intercambio. Por eso prioriza recuperar fidelidad de edición frente a compatibilidad con otros programas 3D.
