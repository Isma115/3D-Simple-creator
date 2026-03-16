import * as THREE from 'three';

export function attachSelection({ camera, renderer, entryManager, blockManager, state, onUpdate, scene }) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredEntry = null;
    let hoveredBlock = null;
    const gridHoverMesh = new THREE.Mesh(state.pointGeometry, state.pointMaterial.clone());
    gridHoverMesh.renderOrder = 2;
    gridHoverMesh.visible = false;
    scene.add(gridHoverMesh);

    function updateMouse(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickEntry() {
        const entries = entryManager.getPointEntries().filter((entry) => entry.active && entry.faceEligible);
        if (entries.length === 0) return null;
        const meshes = entries.map((entry) => entry.mesh);
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length === 0) return null;
        const entry = entryManager.getEntryByMesh(hits[0].object);
        return entry ?? null;
    }

    function pickBlockEntry() {
        if (!blockManager) return null;
        const entries = blockManager.getBlockEntries().filter((entry) => entry.active);
        if (entries.length === 0) return null;
        const meshes = entries.map((entry) => entry.mesh);
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length === 0) return null;
        const entry = blockManager.getBlockByMesh(hits[0].object);
        return entry ?? null;
    }

    function getPlaneUV(point, axis) {
        if (axis === 'x') return { u: point.y, v: point.z };
        if (axis === 'y') return { u: point.x, v: point.z };
        return { u: point.x, v: point.y };
    }

    function planeUVToPoint(axis, value, u, v) {
        if (axis === 'x') return new THREE.Vector3(value, u, v);
        if (axis === 'y') return new THREE.Vector3(u, value, v);
        return new THREE.Vector3(u, v, value);
    }

    function vertexInCells(u, v, cells) {
        if (!cells || cells.size === 0) return false;
        const candidates = [
            `${u},${v}`,
            `${u - 1},${v}`,
            `${u},${v - 1}`,
            `${u - 1},${v - 1}`
        ];
        for (const key of candidates) {
            if (cells.has(key)) return true;
        }
        return false;
    }

    function pickGridPoint() {
        const planeMeshes = [];
        const planeByMesh = new Map();
        for (const planeData of state.planeFill.values()) {
            if (!planeData || !planeData.mesh) continue;
            planeMeshes.push(planeData.mesh);
            planeByMesh.set(planeData.mesh, planeData);
        }
        if (planeMeshes.length === 0) return null;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(planeMeshes, false);
        if (hits.length === 0) return null;
        const hit = hits[0];
        const planeData = planeByMesh.get(hit.object);
        if (!planeData || !planeData.cells) return null;
        const { u, v } = getPlaneUV(hit.point, planeData.axis);
        const baseU = Math.floor(u);
        const baseV = Math.floor(v);
        const candidates = [
            { u: baseU, v: baseV },
            { u: baseU + 1, v: baseV },
            { u: baseU, v: baseV + 1 },
            { u: baseU + 1, v: baseV + 1 }
        ];
        let best = null;
        let bestDist = Infinity;
        for (const candidate of candidates) {
            if (!vertexInCells(candidate.u, candidate.v, planeData.cells)) continue;
            const du = u - candidate.u;
            const dv = v - candidate.v;
            const dist = du * du + dv * dv;
            if (dist < bestDist) {
                bestDist = dist;
                best = candidate;
            }
        }
        if (!best) return null;
        return planeUVToPoint(planeData.axis, planeData.value, best.u, best.v);
    }

    function handleHover(nextEntry) {
        if (hoveredEntry === nextEntry) return;
        if (hoveredEntry) entryManager.setHovered(hoveredEntry, false);
        hoveredEntry = nextEntry;
        state.hoveredEntry = hoveredEntry;
        if (hoveredEntry) entryManager.setHovered(hoveredEntry, true);
    }

    function handleBlockHover(nextEntry) {
        if (!blockManager) return;
        if (hoveredBlock === nextEntry) return;
        if (hoveredBlock) blockManager.setHovered(hoveredBlock, false);
        hoveredBlock = nextEntry;
        state.hoveredBlock = hoveredBlock;
        if (hoveredBlock) blockManager.setHovered(hoveredBlock, true);
    }

    function handleSelect(entry) {
        if (state.selectedEntry && state.selectedEntry !== entry) {
            entryManager.setSelected(state.selectedEntry, false);
        }
        state.selectedEntry = entry;
        if (state.selectedEntry) {
            entryManager.setSelected(state.selectedEntry, true);
            state.currentPosition.copy(state.selectedEntry.position);
            state.cursorMesh.position.copy(state.currentPosition);
            state.pathPoints = [state.currentPosition.clone()];
            onUpdate();
        }
    }

    function handleBlockSelect(entry) {
        if (!blockManager) return;
        if (state.selectedBlock && state.selectedBlock !== entry) {
            blockManager.setSelected(state.selectedBlock, false);
        }
        state.selectedBlock = entry;
        if (state.selectedBlock) {
            blockManager.setSelected(state.selectedBlock, true);
            state.currentPosition.copy(state.selectedBlock.position);
            state.cursorMesh.position.copy(state.currentPosition);
            state.pathPoints = [state.currentPosition.clone()];
            onUpdate();
        }
    }

    function handleGridHover(position) {
        if (!position) {
            gridHoverMesh.visible = false;
            return;
        }
        gridHoverMesh.position.copy(position);
        gridHoverMesh.visible = true;
    }

    function handleGridSelect(position) {
        if (state.selectedEntry) {
            entryManager.setSelected(state.selectedEntry, false);
            state.selectedEntry = null;
        }
        if (!position) return;
        state.currentPosition.copy(position);
        state.cursorMesh.position.copy(state.currentPosition);
        state.pathPoints = [state.currentPosition.clone()];
        onUpdate();
    }

    function onMouseMove(event) {
        updateMouse(event);
        if (state.controlMode !== 'lines') {
            const blockEntry = pickBlockEntry();
            handleBlockHover(blockEntry);
            handleHover(null);
            handleGridHover(null);
            return;
        }
        const entry = pickEntry();
        if (entry) {
            handleHover(entry);
            handleGridHover(null);
            return;
        }
        handleHover(null);
        const gridPoint = pickGridPoint();
        handleGridHover(gridPoint);
    }

    function onClick(event) {
        updateMouse(event);
        if (state.controlMode === 'blocks-keyboard') {
            const blockEntry = pickBlockEntry();
            handleBlockSelect(blockEntry);
            handleBlockHover(null);
            handleGridHover(null);
            return;
        }
        if (state.controlMode === 'blocks-mouse') {
            handleBlockHover(null);
            handleGridHover(null);
            return;
        }
        const entry = pickEntry();
        if (entry) {
            handleSelect(entry);
            handleGridHover(null);
            return;
        }
        const gridPoint = pickGridPoint();
        handleGridSelect(gridPoint);
        handleGridHover(null);
    }

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);

    return {
        clearSelection: () => {
            if (hoveredEntry) entryManager.setHovered(hoveredEntry, false);
            if (state.selectedEntry) entryManager.setSelected(state.selectedEntry, false);
            hoveredEntry = null;
            state.selectedEntry = null;
            state.hoveredEntry = null;
            if (blockManager) {
                if (hoveredBlock) blockManager.setHovered(hoveredBlock, false);
                if (state.selectedBlock) blockManager.setSelected(state.selectedBlock, false);
                hoveredBlock = null;
                state.selectedBlock = null;
                state.hoveredBlock = null;
            }
            gridHoverMesh.visible = false;
        }
    };
}
