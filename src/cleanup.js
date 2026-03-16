import { getEdgePlaneCandidates, getPlaneKey, getVertexKey } from './geometry.js';

function buildEdgeKey(a, b) {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildPlaneEdgeKey(u1, v1, u2, v2) {
    const a = `${u1},${v1}`;
    const b = `${u2},${v2}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function buildBoundaryEdges(cells) {
    const edges = new Set();
    for (const cellKey of cells) {
        const [u, v] = cellKey.split(',').map(Number);
        const left = `${u - 1},${v}`;
        const right = `${u + 1},${v}`;
        const down = `${u},${v - 1}`;
        const up = `${u},${v + 1}`;

        if (!cells.has(left)) {
            edges.add(buildPlaneEdgeKey(u, v, u, v + 1));
        }
        if (!cells.has(right)) {
            edges.add(buildPlaneEdgeKey(u + 1, v, u + 1, v + 1));
        }
        if (!cells.has(down)) {
            edges.add(buildPlaneEdgeKey(u, v, u + 1, v));
        }
        if (!cells.has(up)) {
            edges.add(buildPlaneEdgeKey(u, v + 1, u + 1, v + 1));
        }
    }
    return edges;
}

function getLinePlaneEdgeKey(lineEntry, axis) {
    const start = lineEntry.start;
    const end = lineEntry.end;
    let u1;
    let v1;
    let u2;
    let v2;

    if (axis === 'x') {
        u1 = start.y;
        v1 = start.z;
        u2 = end.y;
        v2 = end.z;
    } else if (axis === 'y') {
        u1 = start.x;
        v1 = start.z;
        u2 = end.x;
        v2 = end.z;
    } else {
        u1 = start.x;
        v1 = start.y;
        u2 = end.x;
        v2 = end.y;
    }

    const ru1 = Math.round(u1);
    const rv1 = Math.round(v1);
    const ru2 = Math.round(u2);
    const rv2 = Math.round(v2);
    return buildPlaneEdgeKey(ru1, rv1, ru2, rv2);
}

export function createCleanupManager({ state, entryManager, graphManager, undoManager, onUpdate }) {
    function buildLooseEdgeSet() {
        const edges = new Set();
        for (const vertices of state.looseFaceVertices.values()) {
            if (!vertices || vertices.length < 2) continue;
            for (let i = 0; i < vertices.length; i++) {
                const aKey = vertices[i];
                const bKey = vertices[(i + 1) % vertices.length];
                edges.add(buildEdgeKey(aKey, bKey));
            }
        }
        return edges;
    }

    function removeLinesWithoutFace() {
        const looseEdges = buildLooseEdgeSet();
        const planeBoundaryEdges = new Map();

        const removedLines = [];
        const removedEdges = [];
        const lineEntries = entryManager.getLineEntries();

        for (const lineEntry of lineEntries) {
            if (!lineEntry.active) continue;
            const aKey = lineEntry.aKey ?? getVertexKey(lineEntry.start);
            const bKey = lineEntry.bKey ?? getVertexKey(lineEntry.end);
            const edgeKey = buildEdgeKey(aKey, bKey);

            if (looseEdges.has(edgeKey)) {
                continue;
            }

            let belongsToPlaneBoundary = false;
            const planeCandidates = getEdgePlaneCandidates(lineEntry.start, lineEntry.end);
            for (const plane of planeCandidates) {
                const planeKey = getPlaneKey(plane.axis, plane.value);
                const planeData = state.planeFill.get(planeKey);
                if (!planeData || !planeData.cells || planeData.cells.size === 0) continue;
                if (!planeBoundaryEdges.has(planeKey)) {
                    planeBoundaryEdges.set(planeKey, buildBoundaryEdges(planeData.cells));
                }
                const boundaryEdges = planeBoundaryEdges.get(planeKey);
                const planeEdgeKey = getLinePlaneEdgeKey(lineEntry, plane.axis);
                if (boundaryEdges && boundaryEdges.has(planeEdgeKey)) {
                    belongsToPlaneBoundary = true;
                    break;
                }
            }

            if (belongsToPlaneBoundary) {
                continue;
            }

            lineEntry.active = false;
            entryManager.refreshEntryVisibility(lineEntry);
            removedLines.push(lineEntry);

            const planeKeys = planeCandidates.map((plane) => getPlaneKey(plane.axis, plane.value));
            removedEdges.push({ aKey, bKey, planeKeys });
            for (const planeKey of planeKeys) {
                graphManager.removeEdge(planeKey, aKey, bKey);
            }
        }

        if (removedLines.length === 0) return;

        undoManager.pushAction({
            kind: 'delete',
            lineEntries: removedLines,
            edges: removedEdges
        });

        onUpdate();
    }

    return { removeLinesWithoutFace };
}
