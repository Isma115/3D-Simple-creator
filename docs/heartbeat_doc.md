# Documentacion de Heartbeat (`src/heartbeat.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo mantiene vivo el servidor mientras la pestana esta abierta y lo cierra rapido cuando la cierras.

## Explicacion Tecnica
`src/heartbeat.js` expone `startHeartbeat()`:
- Envia peticiones periodicas a `/heartbeat` para indicar actividad.
- Usa `navigator.sendBeacon('/shutdown')` al cerrar la pestana para un apagado inmediato.

Se mantiene separado para no mezclar networking con el dibujo 3D.
