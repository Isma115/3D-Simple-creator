import * as THREE from 'three';
import { STEP_SIZE, FACE_EPSILON } from './constants.js';
import {
    getBestAxis,
    ensureVertex,
    getVertexKey,
    getEdgePlaneCandidates,
    getPlaneKey,
    getAxisAlignedPlane,
    findLoopStartIndex,
    pointsEqual
} from './geometry.js';

function createLine(state, start, end) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, state.lineMaterial);
    line.renderOrder = 1;
    return line;
}

function createPointMarker(state, position) {
    const point = new THREE.Mesh(state.pointGeometry, state.pointMaterial.clone());
    point.position.copy(position);
    point.renderOrder = 2;
    return point;
}

function clonePath(pathPoints = []) {
    return pathPoints.map((point) => point.clone());
}

function resolvePathBefore(pathPoints, startPoint) {
    const snapshot = clonePath(pathPoints);
    if (snapshot.length === 0) {
        return [startPoint.clone()];
    }
    const lastPoint = snapshot[snapshot.length - 1];
    if (!pointsEqual(lastPoint, startPoint)) {
        return [startPoint.clone()];
    }
    return snapshot;
}

function buildEdgeKey(aKey, bKey) {
    return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
}

function hasActiveLineBetweenKeys(entryManager, aKey, bKey) {
    if (!entryManager?.getLineEntries || !aKey || !bKey) return false;
    const targetEdgeKey = buildEdgeKey(aKey, bKey);
    for (const lineEntry of entryManager.getLineEntries()) {
        if (!lineEntry.active) continue;
        const lineAKey = lineEntry.aKey ?? getVertexKey(lineEntry.start);
        const lineBKey = lineEntry.bKey ?? getVertexKey(lineEntry.end);
        if (buildEdgeKey(lineAKey, lineBKey) === targetEdgeKey) {
            return true;
        }
    }
    return false;
}

function addAdjacencyEdge(adjacency, edgeSources, aKey, bKey, source, excludedEdgeKey = null) {
    if (!aKey || !bKey || aKey === bKey) return;
    const edgeKey = buildEdgeKey(aKey, bKey);
    if (excludedEdgeKey && edgeKey === excludedEdgeKey) return;
    if (!adjacency.has(aKey)) adjacency.set(aKey, new Set());
    if (!adjacency.has(bKey)) adjacency.set(bKey, new Set());
    adjacency.get(aKey).add(bKey);
    adjacency.get(bKey).add(aKey);
    if (!edgeSources.has(edgeKey)) {
        edgeSources.set(edgeKey, new Set());
    }
    edgeSources.get(edgeKey).add(source);
}

function getBlockFaceCorners(entry, axis, direction) {
    const size = entry.size ?? STEP_SIZE;
    const half = size / 2;
    const { x, y, z } = entry.position;
    if (axis === 'x') {
        const px = x + direction * half;
        return [
            new THREE.Vector3(px, y - half, z - half),
            new THREE.Vector3(px, y - half, z + half),
            new THREE.Vector3(px, y + half, z + half),
            new THREE.Vector3(px, y + half, z - half)
        ];
    }
    if (axis === 'y') {
        const py = y + direction * half;
        return [
            new THREE.Vector3(x - half, py, z - half),
            new THREE.Vector3(x + half, py, z - half),
            new THREE.Vector3(x + half, py, z + half),
            new THREE.Vector3(x - half, py, z + half)
        ];
    }
    const pz = z + direction * half;
    return [
        new THREE.Vector3(x - half, y - half, pz),
        new THREE.Vector3(x + half, y - half, pz),
        new THREE.Vector3(x + half, y + half, pz),
        new THREE.Vector3(x - half, y + half, pz)
    ];
}

function isPointInsideBlock(point, entry) {
    const size = entry.size ?? STEP_SIZE;
    const half = size / 2;
    const epsilon = FACE_EPSILON * 10;
    return (
        point.x >= entry.position.x - half - epsilon &&
        point.x <= entry.position.x + half + epsilon &&
        point.y >= entry.position.y - half - epsilon &&
        point.y <= entry.position.y + half + epsilon &&
        point.z >= entry.position.z - half - epsilon &&
        point.z <= entry.position.z + half + epsilon
    );
}

function addBlockBoundaryEdges(adjacency, edgeSources, blockManager, excludedEdgeKey = null) {
    if (!blockManager) return;
    const activeBlocks = blockManager.getBlockEntries().filter((entry) => entry.active);
    const faces = [
        { axis: 'x', direction: -1 },
        { axis: 'x', direction: 1 },
        { axis: 'y', direction: -1 },
        { axis: 'y', direction: 1 },
        { axis: 'z', direction: -1 },
        { axis: 'z', direction: 1 }
    ];

    for (const entry of activeBlocks) {
        const size = entry.size ?? STEP_SIZE;
        const sampleOffset = Math.max(size * 0.001, FACE_EPSILON * 10);
        for (const face of faces) {
            const samplePoint = entry.position.clone();
            samplePoint[face.axis] += face.direction * (size / 2 + sampleOffset);
            const covered = activeBlocks.some((other) => other !== entry && isPointInsideBlock(samplePoint, other));
            if (covered) continue;

            const corners = getBlockFaceCorners(entry, face.axis, face.direction);
            for (let i = 0; i < corners.length; i++) {
                const aKey = getVertexKey(corners[i]);
                const bKey = getVertexKey(corners[(i + 1) % corners.length]);
                addAdjacencyEdge(adjacency, edgeSources, aKey, bKey, 'block', excludedEdgeKey);
            }
        }
    }
}

function addLineEdges(adjacency, edgeSources, entryManager, excludedEdgeKey = null) {
    const lineEntries = entryManager.getLineEntries ? entryManager.getLineEntries() : [];
    for (const lineEntry of lineEntries) {
        if (!lineEntry.active) continue;
        const aKey = lineEntry.aKey ?? getVertexKey(lineEntry.start);
        const bKey = lineEntry.bKey ?? getVertexKey(lineEntry.end);
        addAdjacencyEdge(adjacency, edgeSources, aKey, bKey, 'line', excludedEdgeKey);
    }
}

function pathUsesLineEdge(path, edgeSources) {
    for (let i = 0; i < path.length - 1; i++) {
        const edgeKey = buildEdgeKey(path[i], path[i + 1]);
        if (edgeSources.get(edgeKey)?.has('line')) {
            return true;
        }
    }
    return false;
}

function recordFaceResult(faceResult, faces, faceKeys, planeUpdates, faceVertexMap) {
    if (!faceResult) return false;
    if (faceResult.planeUpdate) {
        planeUpdates.push(faceResult.planeUpdate);
    }
    if (faceResult.face) {
        faces.push(faceResult.face);
        faceKeys.push(faceResult.faceKey);
    }
    if (faceResult.faceVertices && faceResult.faceKey) {
        faceVertexMap.set(faceResult.faceKey, faceResult.faceVertices);
    }
    return true;
}

function tryCreateFaceFromBoundaryGraph({
    state,
    entryManager,
    blockManager,
    faceController,
    startKey,
    endKey,
    faces,
    faceKeys,
    planeUpdates,
    faceVertexMap
}) {
    if (!blockManager) return false;

    const adjacency = new Map();
    const edgeSources = new Map();
    const excludedEdgeKey = buildEdgeKey(startKey, endKey);
    addLineEdges(adjacency, edgeSources, entryManager, excludedEdgeKey);
    addBlockBoundaryEdges(adjacency, edgeSources, blockManager, excludedEdgeKey);

    const queue = [[endKey]];
    const maxDepth = 8;
    const maxExploredPaths = 512;
    let explored = 0;

    while (queue.length > 0 && explored < maxExploredPaths) {
        const path = queue.shift();
        explored += 1;

        const currentKey = path[path.length - 1];
        if (currentKey === startKey && path.length > 1) {
            if (!pathUsesLineEdge(path, edgeSources)) {
                continue;
            }
            const loopKeys = [startKey, ...path];
            if (loopKeys[loopKeys.length - 1] === startKey) {
                loopKeys.pop();
            }
            const uniqueKeys = new Set(loopKeys);
            if (uniqueKeys.size !== loopKeys.length || loopKeys.length < 3) {
                continue;
            }
            const loopPoints = loopKeys.map((key) => state.vertexPositions.get(key));
            if (loopPoints.some((point) => !point)) {
                continue;
            }
            const faceResult = faceController.processLoopFace(loopPoints, null);
            if (faceResult) {
                return recordFaceResult(faceResult, faces, faceKeys, planeUpdates, faceVertexMap);
            }
            continue;
        }

        if (path.length - 1 >= maxDepth) {
            continue;
        }

        const neighbors = adjacency.get(currentKey);
        if (!neighbors || neighbors.size === 0) {
            continue;
        }

        const sortedNeighbors = [...neighbors].sort((left, right) => {
            const leftIsLine = edgeSources.get(buildEdgeKey(currentKey, left))?.has('line') ? 1 : 0;
            const rightIsLine = edgeSources.get(buildEdgeKey(currentKey, right))?.has('line') ? 1 : 0;
            return rightIsLine - leftIsLine;
        });

        for (const neighbor of sortedNeighbors) {
            if (neighbor !== startKey && path.includes(neighbor)) {
                continue;
            }
            queue.push([...path, neighbor]);
        }
    }

    return false;
}

export function drawLineBetweenPoints({
    state,
    entryManager,
    faceController,
    graphManager,
    blockManager = null,
    undoManager,
    onUpdate,
    startPoint,
    endPoint,
    pathBeforeOverride = null
}) {
    if (!startPoint || !endPoint || pointsEqual(startPoint, endPoint)) {
        return false;
    }

    const start = startPoint.clone();
    const end = endPoint.clone();

    state.currentPosition.copy(end);
    state.cursorMesh.position.copy(state.currentPosition);

    const aKey = ensureVertex(state.vertexPositions, start);
    const bKey = ensureVertex(state.vertexPositions, end);
    if (hasActiveLineBetweenKeys(entryManager, aKey, bKey)) {
        state.currentPosition.copy(end);
        state.cursorMesh.position.copy(state.currentPosition);
        return false;
    }

    const line = createLine(state, start, end);
    const lineEntry = entryManager.registerLineEntry(line, start, end);
    lineEntry.aKey = aKey;
    lineEntry.bKey = bKey;

    const point = createPointMarker(state, end);
    const pointEntry = entryManager.registerPointEntry(point, end, bKey);

    state.drawingPoints.push(end.clone());

    const pathBefore = resolvePathBefore(pathBeforeOverride ?? state.pathPoints, start);
    state.pathPoints = clonePath(pathBefore);
    state.pathPoints.push(end.clone());

    const faces = [];
    const faceKeys = [];
    const planeUpdates = [];
    const faceVertexMap = new Map();
    const planeCandidates = getEdgePlaneCandidates(start, end);
    const planeKeys = [];

    for (const plane of planeCandidates) {
        const planeKey = getPlaneKey(plane.axis, plane.value);
        planeKeys.push(planeKey);
        graphManager.addEdge(planeKey, aKey, bKey);

        const path = graphManager.findPath(planeKey, bKey, aKey, aKey, bKey);
        if (path && path.length >= 3) {
            const loopKeys = [aKey, ...path];
            if (loopKeys[loopKeys.length - 1] === aKey) {
                loopKeys.pop();
            }
            const loopPoints = loopKeys.map((key) => state.vertexPositions.get(key));
            recordFaceResult(faceController.processLoopFace(loopPoints, planeKey), faces, faceKeys, planeUpdates, faceVertexMap);
        }
    }

    tryCreateFaceFromBoundaryGraph({
        state,
        entryManager,
        blockManager,
        faceController,
        startKey: aKey,
        endKey: bKey,
        faces,
        faceKeys,
        planeUpdates,
        faceVertexMap
    });

    const pointPlaneKeys = [
        getPlaneKey('x', end.x),
        getPlaneKey('y', end.y),
        getPlaneKey('z', end.z)
    ];
    for (const planeKey of [...planeKeys, ...pointPlaneKeys]) {
        entryManager.updatePlaneVisibility(planeKey);
    }

    let pathAfter = clonePath(state.pathPoints);
    const loopStartIndex = findLoopStartIndex(state.pathPoints, end);
    if (loopStartIndex !== -1) {
        const loopPoints = state.pathPoints.slice(loopStartIndex, -1);
        if (loopPoints.length >= 3) {
            const planeInfo = getAxisAlignedPlane(loopPoints);
            const planeKey = planeInfo ? getPlaneKey(planeInfo.axis, planeInfo.value) : null;
            const faceResult = faceController.processLoopFace(loopPoints, planeKey);
            recordFaceResult(faceResult, faces, faceKeys, planeUpdates, faceVertexMap);
            if (faceResult && faceResult.hadFace) {
                pathAfter = [end.clone()];
                state.pathPoints = clonePath(pathAfter);
            }
        }
    }

    undoManager.pushAction({
        from: start,
        to: end.clone(),
        lineEntry,
        pointEntry,
        faces,
        faceKeys,
        planeUpdates,
        faceVertexMap: Array.from(faceVertexMap.entries()),
        edge: {
            aKey,
            bKey,
            planeKeys
        },
        pathBefore,
        pathAfter
    });

    onUpdate();
    return true;
}

export function attachKeyboardControls({
    scene,
    state,
    camera,
    entryManager,
    faceController,
    graphManager,
    blockManager,
    undoManager,
    onUpdate
}) {

    function deleteSelectedBlock() {
        const selectedBlock = state.selectedBlock ?? state.hoveredBlock;
        if (!selectedBlock || !selectedBlock.active) return;

        selectedBlock.active = false;
        if (blockManager) {
            blockManager.refreshEntryVisibility(selectedBlock);
            if (state.selectedBlock) {
                blockManager.setSelected(state.selectedBlock, false);
            }
            if (state.hoveredBlock) {
                blockManager.setHovered(state.hoveredBlock, false);
            }
        }
        state.selectedBlock = null;
        state.hoveredBlock = null;

        undoManager.pushAction({
            kind: 'block-delete',
            blockEntries: [selectedBlock]
        });

        onUpdate();
    }

    function deleteSelectedPoint() {
        const selectedEntry = state.selectedEntry ?? state.hoveredEntry;
        if (!selectedEntry || !selectedEntry.active) return;

        const targetKey = selectedEntry.vertexKey ?? getVertexKey(selectedEntry.position);
        if (state.selectedPointKeys.includes(targetKey)) {
            entryManager.setMultiSelectedByKey(targetKey, false);
            state.selectedPointKeys = state.selectedPointKeys.filter((key) => key !== targetKey);
        }
        const targetPosition = selectedEntry.position.clone();
        const removedPointEntries = entryManager.getPointEntries().filter((entry) => {
            if (!entry.active) return false;
            const entryKey = entry.vertexKey ?? getVertexKey(entry.position);
            return entryKey === targetKey;
        });
        if (removedPointEntries.length === 0) return;

        const removedLineEntries = [];
        const removedEdges = [];
        const affectedPlaneKeys = new Set();

        const lineEntries = entryManager.getLineEntries ? entryManager.getLineEntries() : [];
        for (const lineEntry of lineEntries) {
            if (!lineEntry.active) continue;
            const aKey = lineEntry.aKey ?? getVertexKey(lineEntry.start);
            const bKey = lineEntry.bKey ?? getVertexKey(lineEntry.end);
            if (aKey !== targetKey && bKey !== targetKey) continue;

            lineEntry.active = false;
            entryManager.refreshEntryVisibility(lineEntry);
            removedLineEntries.push(lineEntry);

            const planeCandidates = getEdgePlaneCandidates(lineEntry.start, lineEntry.end);
            const planeKeys = planeCandidates.map((plane) => getPlaneKey(plane.axis, plane.value));
            removedEdges.push({ aKey, bKey, planeKeys });
            for (const planeKey of planeKeys) {
                graphManager.removeEdge(planeKey, aKey, bKey);
                affectedPlaneKeys.add(planeKey);
            }
        }

        for (const entry of removedPointEntries) {
            entry.active = false;
            entryManager.refreshEntryVisibility(entry);
        }

        if (state.selectedEntry) {
            entryManager.setSelected(state.selectedEntry, false);
        }
        if (state.hoveredEntry) {
            entryManager.setHovered(state.hoveredEntry, false);
        }
        state.selectedEntry = null;
        state.hoveredEntry = null;

        const removedFaces = [];
        const removedFaceKeys = [];
        const removedFaceVertexMap = [];
        for (const [faceKey, vertices] of state.looseFaceVertices.entries()) {
            if (!vertices.includes(targetKey)) continue;
            const mesh = state.looseFaceMeshes.get(faceKey);
            if (mesh) {
                scene.remove(mesh);
                removedFaces.push(mesh);
            }
            removedFaceKeys.push(faceKey);
            removedFaceVertexMap.push([faceKey, vertices]);
            state.faceRegistry.delete(faceKey);
            state.looseFaceVertices.delete(faceKey);
            state.looseFaceMeshes.delete(faceKey);
        }

        const planeUpdates = [];
        const planesToRemove = [];
        for (const [planeKey, planeData] of state.planeFill.entries()) {
            if (!planeData || !planeData.cells || planeData.cells.size === 0) continue;
            const axis = planeData.axis;
            const value = planeData.value;
            if (Math.abs(targetPosition[axis] - value) > FACE_EPSILON) continue;
            let u;
            let v;
            if (axis === 'x') {
                u = targetPosition.y;
                v = targetPosition.z;
            } else if (axis === 'y') {
                u = targetPosition.x;
                v = targetPosition.z;
            } else {
                u = targetPosition.x;
                v = targetPosition.y;
            }
            const roundedU = Math.round(u);
            const roundedV = Math.round(v);
            const candidates = [
                `${roundedU},${roundedV}`,
                `${roundedU - 1},${roundedV}`,
                `${roundedU},${roundedV - 1}`,
                `${roundedU - 1},${roundedV - 1}`
            ];
            let present = 0;
            for (const key of candidates) {
                if (planeData.cells.has(key)) present += 1;
            }
            if (present === 0 || present === 4) continue;
            planesToRemove.push({ planeKey, planeData });
        }

        for (const { planeKey, planeData } of planesToRemove) {
            planeUpdates.push({
                planeKey,
                axis: planeData.axis,
                value: planeData.value,
                prevCells: Array.from(planeData.cells ?? []),
                nextCells: [],
                prevMesh: planeData.mesh ?? null,
                nextMesh: null,
                prevGridLines: planeData.gridLines ?? null,
                nextGridLines: null,
                prevBoundaryKeys: Array.from(planeData.boundaryVertexKeys ?? []),
                nextBoundaryKeys: []
            });
            if (planeData.mesh) scene.remove(planeData.mesh);
            if (planeData.gridLines) scene.remove(planeData.gridLines);
            state.planeFill.delete(planeKey);
            affectedPlaneKeys.add(planeKey);
        }

        for (const planeKey of affectedPlaneKeys) {
            entryManager.updatePlaneVisibility(planeKey);
        }

        undoManager.pushAction({
            kind: 'delete',
            pointEntries: removedPointEntries,
            lineEntries: removedLineEntries,
            faces: removedFaces,
            faceKeys: removedFaceKeys,
            faceVertexMap: removedFaceVertexMap,
            planeUpdates,
            edges: removedEdges
        });

        onUpdate();
    }

    window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        const hasModifier = event.ctrlKey || event.metaKey;

        if (hasModifier && key === 'z') {
            event.preventDefault();
            if (event.shiftKey) {
                undoManager.performRedo();
            } else {
                undoManager.performUndo();
            }
            return;
        }

        if (hasModifier && key === 'y') {
            event.preventDefault();
            undoManager.performRedo();
            return;
        }

        const deleteKeys = new Set(['Delete', 'Backspace', 'Del', 'Supr']);
        if (deleteKeys.has(event.key) || deleteKeys.has(event.code)) {
            event.preventDefault();
            if (!hasModifier) {
                if ((state.controlMode === 'blocks-keyboard' || state.controlMode === 'blocks-mouse') && blockManager) {
                    deleteSelectedBlock();
                } else {
                    deleteSelectedPoint();
                }
            }
            return;
        }

        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;

        event.preventDefault();

        const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
        const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();

        let moveVector;

        switch (event.key) {
            case 'ArrowUp':
                moveVector = getBestAxis(cameraUp);
                break;
            case 'ArrowDown':
                moveVector = getBestAxis(cameraUp.clone().negate());
                break;
            case 'ArrowRight':
                moveVector = getBestAxis(cameraRight);
                break;
            case 'ArrowLeft':
                moveVector = getBestAxis(cameraRight.clone().negate());
                break;
        }

        if (!moveVector) return;

        if (state.controlMode === 'blocks-keyboard' && blockManager) {
            const startPoint = state.currentPosition.clone();
            const activeBlock = state.selectedBlock ?? state.hoveredBlock;
            const stepSize = activeBlock ? activeBlock.size ?? STEP_SIZE : STEP_SIZE;
            state.currentPosition.add(moveVector.multiplyScalar(stepSize));
            state.cursorMesh.position.copy(state.currentPosition);
            state.pathPoints = [state.currentPosition.clone()];

            const { entry, created } = blockManager.registerBlock(state.currentPosition.clone(), stepSize);
            if (state.selectedBlock && state.selectedBlock !== entry) {
                blockManager.setSelected(state.selectedBlock, false);
            }
            state.selectedBlock = entry;
            blockManager.setSelected(entry, true);
            state.hoveredBlock = null;

            if (created) {
                undoManager.pushAction({
                    kind: 'block-add',
                    blockEntries: [entry],
                    cursorBefore: startPoint.clone(),
                    cursorAfter: state.currentPosition.clone()
                });
            }

            onUpdate();
            return;
        }
        if (state.controlMode === 'blocks-mouse' || state.controlMode === 'points') {
            return;
        }

        const startPoint = state.currentPosition.clone();
        const endPoint = startPoint.clone().add(moveVector.multiplyScalar(STEP_SIZE));
        drawLineBetweenPoints({
            state,
            entryManager,
            faceController,
            graphManager,
            blockManager,
            undoManager,
            onUpdate,
            startPoint,
            endPoint
        });
    });
}
