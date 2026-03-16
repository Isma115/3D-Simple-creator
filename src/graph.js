export function createGraphManager(planeGraphs) {
    function getPlaneGraph(planeKey) {
        if (!planeGraphs.has(planeKey)) {
            planeGraphs.set(planeKey, { adjacency: new Map() });
        }
        return planeGraphs.get(planeKey);
    }

    function addEdge(planeKey, aKey, bKey) {
        const graph = getPlaneGraph(planeKey);
        if (!graph.adjacency.has(aKey)) graph.adjacency.set(aKey, new Set());
        if (!graph.adjacency.has(bKey)) graph.adjacency.set(bKey, new Set());
        graph.adjacency.get(aKey).add(bKey);
        graph.adjacency.get(bKey).add(aKey);
    }

    function removeEdge(planeKey, aKey, bKey) {
        const graph = planeGraphs.get(planeKey);
        if (!graph) return;
        const aNeighbors = graph.adjacency.get(aKey);
        if (aNeighbors) {
            aNeighbors.delete(bKey);
            if (aNeighbors.size === 0) graph.adjacency.delete(aKey);
        }
        const bNeighbors = graph.adjacency.get(bKey);
        if (bNeighbors) {
            bNeighbors.delete(aKey);
            if (bNeighbors.size === 0) graph.adjacency.delete(bKey);
        }
        if (graph.adjacency.size === 0) {
            planeGraphs.delete(planeKey);
        }
    }

    function findPath(planeKey, startKey, goalKey, blockA, blockB) {
        const graph = planeGraphs.get(planeKey);
        if (!graph) return null;
        const adjacency = graph.adjacency;
        const queue = [startKey];
        const visited = new Set([startKey]);
        const prev = new Map();

        while (queue.length > 0) {
            const current = queue.shift();
            if (current === goalKey) break;
            const neighbors = adjacency.get(current);
            if (!neighbors) continue;
            for (const neighbor of neighbors) {
                if ((current === blockA && neighbor === blockB) || (current === blockB && neighbor === blockA)) {
                    continue;
                }
                if (visited.has(neighbor)) continue;
                visited.add(neighbor);
                prev.set(neighbor, current);
                queue.push(neighbor);
            }
        }

        if (!visited.has(goalKey)) return null;
        const path = [];
        let current = goalKey;
        while (current !== undefined) {
            path.unshift(current);
            if (current === startKey) break;
            current = prev.get(current);
        }
        return path[0] === startKey ? path : null;
    }

    return {
        addEdge,
        removeEdge,
        findPath
    };
}
