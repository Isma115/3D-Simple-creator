import { getVertexKey } from './geometry.js';

const SURFACE_COUNT_BY_GEOMETRY = {
    cube: 6,
    sphere: 1,
    cylinder: 3,
    pyramid: 5,
    cone: 2
};

export function computeVisibleVertices(state) {
    const visibleVertices = new Set();
    for (const planeData of state.planeFill.values()) {
        if (!planeData || !planeData.boundaryVertexKeys) continue;
        for (const key of planeData.boundaryVertexKeys) {
            visibleVertices.add(key);
        }
    }
    for (const vertices of state.looseFaceVertices.values()) {
        for (const key of vertices) {
            visibleVertices.add(key);
        }
    }
    return visibleVertices;
}

function getActiveLineCount(entryManager) {
    let lines = 0;
    for (const entry of entryManager.getLineEntries()) {
        if (entry.active) {
            lines += 1;
        }
    }
    return lines;
}

function getActivePointKeys(entryManager) {
    const pointKeys = new Set();
    for (const entry of entryManager.getPointEntries()) {
        if (!entry.active) continue;
        pointKeys.add(entry.vertexKey ?? getVertexKey(entry.position));
    }
    return pointKeys;
}

function getGeometrySurfaceCount(entry) {
    if (typeof entry.surfaceCount === 'number') {
        return entry.surfaceCount;
    }

    const explicitCount = SURFACE_COUNT_BY_GEOMETRY[entry.geometryType];
    if (explicitCount) {
        return explicitCount;
    }

    const geometry = entry.mesh?.geometry;
    if (!geometry) return 0;
    if (geometry.groups?.length) {
        return geometry.groups.length;
    }
    return 1;
}

function getBlockStats(blockManager) {
    let faces = 0;
    if (!blockManager) {
        return { faces };
    }

    for (const entry of blockManager.getBlockEntries()) {
        if (!entry.active) continue;
        faces += getGeometrySurfaceCount(entry);
    }

    return { faces };
}

export function computeStats(state, entryManager, visibleVertices, blockManager = null) {
    const lines = getActiveLineCount(entryManager);
    const pointKeys = getActivePointKeys(entryManager);
    const blockStats = getBlockStats(blockManager);
    const planeFaces = state.planeFill.size;
    const looseFaces = state.faceRegistry.size;
    const blockFaces = blockStats.faces;
    const faces = planeFaces + looseFaces + blockFaces;
    const vertices = pointKeys.size;

    return {
        faces,
        planeFaces,
        looseFaces,
        blockFaces,
        vertices,
        points: pointKeys.size,
        lines,
        visibleVertices: visibleVertices.size
    };
}
