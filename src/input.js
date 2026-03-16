import * as THREE from 'three';
import { STEP_SIZE, FACE_EPSILON } from './constants.js';
import {
    getBestAxis,
    ensureVertex,
    getVertexKey,
    getEdgePlaneCandidates,
    getPlaneKey,
    getAxisAlignedPlane,
    findLoopStartIndex
} from './geometry.js';

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
    function createLine(start, end) {
        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const line = new THREE.Line(geometry, state.lineMaterial);
        line.renderOrder = 1;
        return line;
    }

    function createPointMarker(position) {
        const point = new THREE.Mesh(state.pointGeometry, state.pointMaterial.clone());
        point.position.copy(position);
        point.renderOrder = 2;
        return point;
    }

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
                if (state.controlMode !== 'lines' && blockManager) {
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
            state.currentPosition.add(moveVector.multiplyScalar(STEP_SIZE));
            state.cursorMesh.position.copy(state.currentPosition);
            state.pathPoints = [state.currentPosition.clone()];

            const { entry, created } = blockManager.registerBlock(state.currentPosition.clone());
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
        if (state.controlMode === 'blocks-mouse') {
            return;
        }

        const startPoint = state.currentPosition.clone();
        state.currentPosition.add(moveVector.multiplyScalar(STEP_SIZE));

        state.cursorMesh.position.copy(state.currentPosition);

        const aKey = ensureVertex(state.vertexPositions, startPoint);
        const bKey = ensureVertex(state.vertexPositions, state.currentPosition);

        const line = createLine(startPoint, state.currentPosition.clone());
        const lineEntry = entryManager.registerLineEntry(line, startPoint, state.currentPosition.clone());
        lineEntry.aKey = aKey;
        lineEntry.bKey = bKey;

        const point = createPointMarker(state.currentPosition.clone());
        const pointEntry = entryManager.registerPointEntry(point, state.currentPosition.clone(), bKey);

        state.drawingPoints.push(state.currentPosition.clone());

        const pathBefore = state.pathPoints.map((p) => p.clone());
        state.pathPoints.push(state.currentPosition.clone());

        const faces = [];
        const faceKeys = [];
        const planeUpdates = [];
        const faceVertexMap = new Map();
        const planeCandidates = getEdgePlaneCandidates(startPoint, state.currentPosition);
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
                const faceResult = faceController.processLoopFace(loopPoints, planeKey);
                if (faceResult) {
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
                }
            }
        }

        const pointPlaneKeys = [
            getPlaneKey('x', state.currentPosition.x),
            getPlaneKey('y', state.currentPosition.y),
            getPlaneKey('z', state.currentPosition.z)
        ];
        for (const planeKey of [...planeKeys, ...pointPlaneKeys]) {
            entryManager.updatePlaneVisibility(planeKey);
        }

        let pathAfter = state.pathPoints.map((p) => p.clone());
        const loopStartIndex = findLoopStartIndex(state.pathPoints, state.currentPosition);
        if (loopStartIndex !== -1) {
            const loopPoints = state.pathPoints.slice(loopStartIndex, -1);
            if (loopPoints.length >= 3) {
                const planeInfo = getAxisAlignedPlane(loopPoints);
                const planeKey = planeInfo ? getPlaneKey(planeInfo.axis, planeInfo.value) : null;
                const faceResult = faceController.processLoopFace(loopPoints, planeKey);
                if (faceResult) {
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
                }
                if (faceResult && faceResult.hadFace) {
                    pathAfter = [state.currentPosition.clone()];
                    state.pathPoints = pathAfter.map((p) => p.clone());
                }
            }
        }

        undoManager.pushAction({
            from: startPoint,
            to: state.currentPosition.clone(),
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
    });
}
