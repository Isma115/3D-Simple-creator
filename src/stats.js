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

export function computeStats(state, entryManager, visibleVertices) {
    const { lines } = entryManager.getCounts();
    const planeFaces = state.planeFill.size;
    const looseFaces = state.faceRegistry.size;
    const faces = planeFaces + looseFaces;
    const vertices = visibleVertices.size;

    return {
        faces,
        planeFaces,
        looseFaces,
        vertices,
        points: visibleVertices.size,
        lines
    };
}
