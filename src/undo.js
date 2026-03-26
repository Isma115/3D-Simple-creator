export function createUndoManager({ scene, state, entryManager, graphManager, blockManager, onUpdate }) {
    function pushAction(action) {
        state.undoStack.push(action);
        state.redoStack.length = 0;
    }

    function getLineEntries(action) {
        const entries = [];
        if (action.lineEntry) entries.push(action.lineEntry);
        if (action.lineEntries) entries.push(...action.lineEntries);
        return entries;
    }

    function getPointEntries(action) {
        const entries = [];
        if (action.pointEntry) entries.push(action.pointEntry);
        if (action.pointEntries) entries.push(...action.pointEntries);
        return entries;
    }

    function getBlockEntries(action) {
        const entries = [];
        if (action.blockEntries) entries.push(...action.blockEntries);
        if (action.childEntries) entries.push(...action.childEntries);
        return entries;
    }

    function getEdges(action) {
        const edges = [];
        if (action.edge) edges.push(action.edge);
        if (action.edges) edges.push(...action.edges);
        return edges;
    }

    function applyEntries(entries, active) {
        for (const entry of entries) {
            entry.active = active;
            entryManager.refreshEntryVisibility(entry);
        }
    }

    function applyBlocks(entries, active) {
        if (!blockManager) return;
        for (const entry of entries) {
            entry.active = active;
            blockManager.refreshEntryVisibility(entry);
            if (!active) {
                if (state.selectedBlock === entry) {
                    blockManager.setSelected(entry, false);
                    state.selectedBlock = null;
                }
                if (state.hoveredBlock === entry) {
                    blockManager.setHovered(entry, false);
                    state.hoveredBlock = null;
                }
            }
        }
    }

    function applyEdges(edges, add) {
        for (const edge of edges) {
            for (const planeKey of edge.planeKeys) {
                if (add) {
                    graphManager.addEdge(planeKey, edge.aKey, edge.bKey);
                } else {
                    graphManager.removeEdge(planeKey, edge.aKey, edge.bKey);
                }
            }
        }
    }

    function applyFaces(faces, add) {
        if (!faces) return;
        for (const face of faces) {
            if (add) scene.add(face);
            else scene.remove(face);
        }
    }

    function applyFaceRegistry(faceKeys, add) {
        if (!faceKeys) return;
        for (const faceKey of faceKeys) {
            if (add) state.faceRegistry.add(faceKey);
            else state.faceRegistry.delete(faceKey);
        }
    }

    function applyFaceVertices(faceVertexMap, add) {
        if (!faceVertexMap) return;
        for (const [faceKey, vertices] of faceVertexMap) {
            if (add) state.looseFaceVertices.set(faceKey, vertices);
            else state.looseFaceVertices.delete(faceKey);
        }
    }

    function applyFaceMeshes(faceKeys, faces, add) {
        if (!state.looseFaceMeshes || !faceKeys || !faces) return;
        const count = Math.min(faceKeys.length, faces.length);
        for (let i = 0; i < count; i++) {
            const faceKey = faceKeys[i];
            const mesh = faces[i];
            if (!faceKey || !mesh) continue;
            if (add) state.looseFaceMeshes.set(faceKey, mesh);
            else state.looseFaceMeshes.delete(faceKey);
        }
    }

    function applyPlaneUpdates(planeUpdates, useNext) {
        if (!planeUpdates) return;
        const updatedPlanes = new Set();
        const updates = useNext ? planeUpdates : [...planeUpdates].reverse();
        for (const update of updates) {
            updatedPlanes.add(update.planeKey);
            if (useNext) {
                if (update.prevMesh) scene.remove(update.prevMesh);
                if (update.prevGridLines) scene.remove(update.prevGridLines);
                if (update.nextMesh) scene.add(update.nextMesh);
                if (update.nextGridLines) scene.add(update.nextGridLines);
                if (!update.nextCells || update.nextCells.length === 0) {
                    state.planeFill.delete(update.planeKey);
                } else {
                    state.planeFill.set(update.planeKey, {
                        axis: update.axis,
                        value: update.value,
                        cells: new Set(update.nextCells),
                        mesh: update.nextMesh,
                        gridLines: update.nextGridLines ?? null,
                        boundaryVertexKeys: update.nextBoundaryKeys ? new Set(update.nextBoundaryKeys) : new Set()
                    });
                }
            } else {
                if (update.nextMesh) scene.remove(update.nextMesh);
                if (update.nextGridLines) scene.remove(update.nextGridLines);
                if (update.prevMesh) scene.add(update.prevMesh);
                if (update.prevGridLines) scene.add(update.prevGridLines);
                if (!update.prevCells || update.prevCells.length === 0) {
                    state.planeFill.delete(update.planeKey);
                } else {
                    state.planeFill.set(update.planeKey, {
                        axis: update.axis,
                        value: update.value,
                        cells: new Set(update.prevCells),
                        mesh: update.prevMesh,
                        gridLines: update.prevGridLines ?? null,
                        boundaryVertexKeys: update.prevBoundaryKeys ? new Set(update.prevBoundaryKeys) : new Set()
                    });
                }
            }
        }
        for (const planeKey of updatedPlanes) {
            entryManager.updatePlaneVisibility(planeKey);
        }
    }

    function performUndo() {
        const action = state.undoStack.pop();
        if (!action) return;

        const isDelete = action.kind === 'delete';
        const isBlockDelete = action.kind === 'block-delete';
        const isBlockAdd = action.kind === 'block-add';
        const isBlockSplit = action.kind === 'block-split';
        const lineEntries = getLineEntries(action);
        const pointEntries = getPointEntries(action);
        const blockEntries = getBlockEntries(action);
        const edges = getEdges(action);

        applyEntries(lineEntries, isDelete);
        applyEntries(pointEntries, isDelete);
        if (blockEntries.length > 0) {
            if (isBlockDelete) {
                applyBlocks(blockEntries, true);
            } else if (isBlockAdd) {
                applyBlocks(blockEntries, false);
            }
        }
        if (isBlockSplit && blockManager) {
            applyBlocks(action.childEntries ?? [], false);
            applyBlocks(action.parentEntry ? [action.parentEntry] : [], true);
        }
        if (action.kind === 'block-move' && blockManager) {
            blockManager.updateBlockPosition(action.entry, action.positionBefore);
        }
        const addFaces = isDelete;
        applyFaces(action.faces, addFaces);
        applyFaceRegistry(action.faceKeys, addFaces);
        applyFaceVertices(action.faceVertexMap, addFaces);
        applyFaceMeshes(action.faceKeys, action.faces, addFaces);

        applyPlaneUpdates(action.planeUpdates, false);
        applyEdges(edges, isDelete);

        if (!isDelete && action.from && action.pathBefore) {
            state.drawingPoints.pop();
            state.currentPosition.copy(action.from);
            state.cursorMesh.position.copy(state.currentPosition);
            state.pathPoints = action.pathBefore.map((point) => point.clone());
        }
        if ((isBlockAdd || isBlockDelete || isBlockSplit) && action.cursorBefore) {
            state.currentPosition.copy(action.cursorBefore);
            state.cursorMesh.position.copy(state.currentPosition);
            state.pathPoints = [state.currentPosition.clone()];
            if (action.sizeBefore !== undefined) {
                state.currentBlockSize = action.sizeBefore;
            }
        }

        state.redoStack.push(action);
        onUpdate();
    }

    function performRedo() {
        const action = state.redoStack.pop();
        if (!action) return;

        const isDelete = action.kind === 'delete';
        const isBlockDelete = action.kind === 'block-delete';
        const isBlockAdd = action.kind === 'block-add';
        const isBlockSplit = action.kind === 'block-split';
        const lineEntries = getLineEntries(action);
        const pointEntries = getPointEntries(action);
        const blockEntries = getBlockEntries(action);
        const edges = getEdges(action);

        applyEntries(lineEntries, !isDelete);
        applyEntries(pointEntries, !isDelete);
        if (blockEntries.length > 0) {
            if (isBlockDelete) {
                applyBlocks(blockEntries, false);
            } else if (isBlockAdd) {
                applyBlocks(blockEntries, true);
            }
        }
        if (isBlockSplit && blockManager) {
            applyBlocks(action.parentEntry ? [action.parentEntry] : [], false);
            applyBlocks(action.childEntries ?? [], true);
        }
        if (action.kind === 'block-move' && blockManager) {
            blockManager.updateBlockPosition(action.entry, action.positionAfter);
        }
        const addFaces = !isDelete;
        applyFaces(action.faces, addFaces);
        applyFaceRegistry(action.faceKeys, addFaces);
        applyFaceVertices(action.faceVertexMap, addFaces);
        applyFaceMeshes(action.faceKeys, action.faces, addFaces);

        applyPlaneUpdates(action.planeUpdates, true);
        applyEdges(edges, !isDelete);

        if (!isDelete && action.to && action.pathAfter) {
            state.drawingPoints.push(action.to.clone());
            state.currentPosition.copy(action.to);
            state.cursorMesh.position.copy(state.currentPosition);
            state.pathPoints = action.pathAfter.map((point) => point.clone());
        }
        if ((isBlockAdd || isBlockDelete || isBlockSplit) && action.cursorAfter) {
            state.currentPosition.copy(action.cursorAfter);
            state.cursorMesh.position.copy(state.currentPosition);
            state.pathPoints = [state.currentPosition.clone()];
            if (action.sizeAfter !== undefined) {
                state.currentBlockSize = action.sizeAfter;
            }
        }

        state.undoStack.push(action);
        onUpdate();
    }

    return {
        pushAction,
        performUndo,
        performRedo
    };
}
