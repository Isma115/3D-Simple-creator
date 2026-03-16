# Documentacion de Grafos de Plano (`src/graph.js`)

## Explicacion Sencilla (No Tecnica)
Este modulo guarda como se conectan los puntos dentro de cada plano. Sirve para detectar cuando has cerrado un contorno y se puede crear una cara.

## Explicacion Tecnica
`src/graph.js` expone `createGraphManager(planeGraphs)` con tres operaciones:
- `addEdge` agrega una arista entre dos vertices en un plano.
- `removeEdge` elimina la arista y limpia el grafo si queda vacio.
- `findPath` busca un camino entre dos vertices evitando una arista concreta, lo que permite detectar ciclos.

Los grafos se almacenan como mapas de adyacencia para busquedas BFS rapidas.
