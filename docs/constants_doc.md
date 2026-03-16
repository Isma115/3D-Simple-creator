# Documentacion de Constantes (`src/constants.js`)

## Explicacion Sencilla (No Tecnica)
Este archivo guarda los numeros y colores fijos de la aplicacion. Asi no hay que buscar valores repetidos por todo el codigo cuando quieras ajustar un color o una tolerancia.

## Explicacion Tecnica
`src/constants.js` exporta configuraciones compartidas:
- `COLORS`: colores base de lineas, puntos y caras.
- `POSITION_EPSILON` y `FACE_EPSILON`: tolerancias para comparaciones numericas.
- `STEP_SIZE`: distancia de cada movimiento del cursor.

Centralizar estos valores evita duplicados y facilita ajustes futuros.
