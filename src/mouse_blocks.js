import * as THREE from 'three';

const PIXEL_CONTROL_MODE = 'blocks-pixel';

export function attachMouseBlockControls({ scene, camera, renderer, state, blockManager, undoManager, onUpdate }) {
    if (!blockManager) return { dispose: () => {} };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const DRAG_THRESHOLD_PX = 3;
    let pointerState = null;
    const previewHost = scene ?? null;
    const pixelPreviewGeometry = new THREE.BoxGeometry(1, 1, 1);
    const pixelPreviewMaterial = new THREE.MeshBasicMaterial({
        color: 0x4aa3ff,
        transparent: true,
        opacity: 0.22,
        wireframe: true,
        depthWrite: false
    });
    const pixelPreviewGroup = new THREE.Group();
    pixelPreviewGroup.visible = false;
    if (previewHost) {
        previewHost.add(pixelPreviewGroup);
    }
    const pixelPreviewMeshes = [];

    function isMouseEditMode() {
        return state.controlMode === 'blocks-mouse' || state.controlMode === PIXEL_CONTROL_MODE;
    }

    function isPixelMode() {
        return state.controlMode === PIXEL_CONTROL_MODE;
    }

    function updateMouse(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function snapToSize(value, size) {
        return Math.round(value / size) * size;
    }

    function getBlockHit() {
        const meshes = blockManager.getActiveBlockMeshes
            ? blockManager.getActiveBlockMeshes()
            : blockManager.getBlockEntries().filter((entry) => entry.active).map((entry) => entry.mesh);
        if (meshes.length === 0) return null;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(meshes, false);
        return hits.length > 0 ? hits[0] : null;
    }

    function isPointInsideEntry(point, entry) {
        const dimensions = entry?.dimensions?.isVector3
            ? entry.dimensions
            : new THREE.Vector3(entry?.size ?? 1, entry?.size ?? 1, entry?.size ?? 1);
        const half = dimensions.clone().multiplyScalar(0.5);
        const epsilon = 1e-4;
        return (
            point.x >= (entry.position.x - half.x - epsilon)
            && point.x <= (entry.position.x + half.x + epsilon)
            && point.y >= (entry.position.y - half.y - epsilon)
            && point.y <= (entry.position.y + half.y + epsilon)
            && point.z >= (entry.position.z - half.z - epsilon)
            && point.z <= (entry.position.z + half.z + epsilon)
        );
    }

    function selectBlockEntry(entry) {
        if (!entry) return;
        if (state.hoveredBlock && state.hoveredBlock !== entry) {
            blockManager.setHovered(state.hoveredBlock, false);
            state.hoveredBlock = null;
        }
        blockManager.setSelection([entry], entry);
    }

    function placeBlocks(positions, size = 1) {
        if (!Array.isArray(positions) || positions.length === 0) return;
        const cursorBefore = state.currentPosition.clone();
        const sizeBefore = state.currentBlockSize;
        const createdEntries = [];
        let lastEntry = null;

        for (const position of positions) {
            const { entry, created } = blockManager.registerBlock(position, size);
            lastEntry = entry;
            if (created) {
                createdEntries.push(entry);
            }
        }

        if (!lastEntry) return;

        state.currentBlockSize = size;
        state.currentPosition.copy(lastEntry.position);
        state.cursorMesh.position.copy(state.currentPosition);
        state.pathPoints = [state.currentPosition.clone()];
        selectBlockEntry(lastEntry);

        if (createdEntries.length > 0) {
            undoManager.pushAction({
                kind: 'block-add',
                blockEntries: createdEntries,
                cursorBefore,
                sizeBefore,
                cursorAfter: lastEntry.position.clone(),
                sizeAfter: size
            });
        }
        onUpdate();
    }

    function deleteBlocks(entries) {
        const uniqueEntries = [];
        const seen = new Set();
        for (const entry of entries ?? []) {
            if (!entry?.active || seen.has(entry)) continue;
            seen.add(entry);
            uniqueEntries.push(entry);
        }
        if (uniqueEntries.length === 0) return;

        for (const entry of uniqueEntries) {
            entry.active = false;
            blockManager.refreshEntryVisibility(entry);
            blockManager.removeFromSelection(entry);
            if (state.hoveredBlock === entry) {
                blockManager.setHovered(entry, false);
                state.hoveredBlock = null;
            }
        }

        undoManager.pushAction({
            kind: 'block-delete',
            blockEntries: uniqueEntries
        });
        onUpdate();
    }

    function getPixelBrushSize() {
        const input = document.getElementById('pixel-brush-size-input');
        const parsed = Number.parseInt(input?.value ?? '1', 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
            return 1;
        }
        return Math.min(parsed, 24);
    }

    function getPixelTraceType() {
        const select = document.getElementById('pixel-trace-type-select');
        return select?.value === 'circle' || select?.value === 'diamond'
            ? select.value
            : 'square';
    }

    function getBrushAxes(normal) {
        if (!normal || normal.lengthSq() <= 1e-8 || Math.abs(normal.y) > 0.6) {
            return {
                u: new THREE.Vector3(1, 0, 0),
                v: new THREE.Vector3(0, 0, 1)
            };
        }
        if (Math.abs(normal.x) > 0.6) {
            return {
                u: new THREE.Vector3(0, 1, 0),
                v: new THREE.Vector3(0, 0, 1)
            };
        }
        return {
            u: new THREE.Vector3(1, 0, 0),
            v: new THREE.Vector3(0, 1, 0)
        };
    }

    function shouldIncludeTracePoint(offsetU, offsetV, brushSize, traceType) {
        if (traceType === 'square') return true;
        const radius = (brushSize - 1) / 2;
        if (radius <= 0) return true;
        const distance = Math.hypot(offsetU, offsetV);
        if (traceType === 'circle') {
            return distance <= (radius + 0.01);
        }
        return (Math.abs(offsetU) + Math.abs(offsetV)) <= (radius + 0.01);
    }

    function buildBrushPositions(center, size, normal, brushSize, traceType) {
        const axes = getBrushAxes(normal);
        const half = Math.floor(brushSize / 2);
        const positions = [];
        const seen = new Set();

        for (let row = 0; row < brushSize; row += 1) {
            for (let col = 0; col < brushSize; col += 1) {
                const offsetU = col - half;
                const offsetV = row - half;
                if (!shouldIncludeTracePoint(offsetU, offsetV, brushSize, traceType)) continue;

                const position = center.clone()
                    .add(axes.u.clone().multiplyScalar(offsetU * size))
                    .add(axes.v.clone().multiplyScalar(offsetV * size));
                position.set(
                    snapToSize(position.x, size),
                    snapToSize(position.y, size),
                    snapToSize(position.z, size)
                );

                const key = `${position.x.toFixed(6)}|${position.y.toFixed(6)}|${position.z.toFixed(6)}`;
                if (seen.has(key)) continue;
                seen.add(key);
                positions.push(position);
            }
        }

        return positions;
    }

    function hidePixelPreview() {
        pixelPreviewGroup.visible = false;
        for (const mesh of pixelPreviewMeshes) {
            mesh.visible = false;
        }
    }

    function ensurePixelPreviewMeshes(count) {
        while (pixelPreviewMeshes.length < count) {
            const mesh = new THREE.Mesh(pixelPreviewGeometry, pixelPreviewMaterial);
            mesh.visible = false;
            mesh.renderOrder = 25;
            pixelPreviewGroup.add(mesh);
            pixelPreviewMeshes.push(mesh);
        }
    }

    function resolvePixelBrushFromMouse() {
        const hit = getBlockHit();
        const brushSize = getPixelBrushSize();
        const traceType = getPixelTraceType();
        const sourceEntry = hit ? blockManager.getBlockByMesh(hit.object) : null;
        const size = sourceEntry?.size ?? state.currentBlockSize;

        let center = null;
        let normal = null;

        if (hit?.face) {
            normal = hit.face.normal.clone().applyQuaternion(hit.object.quaternion).normalize();
            center = hit.object.position.clone().add(normal.clone().multiplyScalar(size));
        } else {
            center = getGroundPlacementPosition(size);
        }
        if (!center) {
            return null;
        }

        return {
            size,
            positions: buildBrushPositions(center, size, normal, brushSize, traceType)
        };
    }

    function updatePixelPreviewFromEvent(event) {
        if (!previewHost) return;
        if (state.workMode !== 'classic' || !isPixelMode()) {
            hidePixelPreview();
            return;
        }

        updateMouse(event);
        const brush = resolvePixelBrushFromMouse();
        if (!brush || brush.positions.length === 0) {
            hidePixelPreview();
            return;
        }

        ensurePixelPreviewMeshes(brush.positions.length);
        pixelPreviewGroup.visible = true;
        const previewScale = Math.max(0.05, brush.size * 0.98);

        for (let index = 0; index < brush.positions.length; index += 1) {
            const mesh = pixelPreviewMeshes[index];
            mesh.visible = true;
            mesh.position.copy(brush.positions[index]);
            mesh.scale.set(previewScale, previewScale, previewScale);
        }
        for (let index = brush.positions.length; index < pixelPreviewMeshes.length; index += 1) {
            pixelPreviewMeshes[index].visible = false;
        }
    }

    function handleLeftClick() {
        if (isPixelMode()) {
            handlePixelPlace();
            return;
        }
        const hit = getBlockHit();
        if (!hit) return;
        const entry = blockManager.getBlockByMesh(hit.object);
        deleteBlocks([entry]);
    }

    function getGroundPlacementPosition(size) {
        raycaster.setFromCamera(mouse, camera);
        const groundHit = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(groundPlane, groundHit)) {
            return null;
        }
        return new THREE.Vector3(
            snapToSize(groundHit.x, size),
            Math.max(size / 2, snapToSize(groundHit.y, size)),
            snapToSize(groundHit.z, size)
        );
    }

    function handleRightClick() {
        const hit = getBlockHit();
        if (hit && hit.face) {
            const entry = blockManager.getBlockByMesh(hit.object);
            const faceNormal = hit.face.normal.clone().applyQuaternion(hit.object.quaternion);
            const size = entry ? entry.size ?? 1 : 1;
            const targetPosition = hit.object.position.clone().add(faceNormal.multiplyScalar(size));
            placeBlocks([new THREE.Vector3(
                snapToSize(targetPosition.x, size),
                snapToSize(targetPosition.y, size),
                snapToSize(targetPosition.z, size)
            )], size);
            return;
        }

        const size = state.currentBlockSize;
        const groundPosition = getGroundPlacementPosition(size);
        if (!groundPosition) return;
        placeBlocks([groundPosition], size);
    }

    function handlePixelPlace() {
        const brush = resolvePixelBrushFromMouse();
        if (!brush || brush.positions.length === 0) return;
        placeBlocks(brush.positions, brush.size);
    }

    function handlePixelErase() {
        const hit = getBlockHit();
        if (!hit) return;
        const sourceEntry = blockManager.getBlockByMesh(hit.object);
        if (!sourceEntry) return;
        const brushSize = getPixelBrushSize();
        const traceType = getPixelTraceType();
        const size = sourceEntry.size ?? 1;
        const normal = hit.face
            ? hit.face.normal.clone().applyQuaternion(hit.object.quaternion).normalize()
            : null;
        const positions = buildBrushPositions(sourceEntry.position.clone(), size, normal, brushSize, traceType);
        const allEntries = blockManager.getActiveBlockEntries
            ? blockManager.getActiveBlockEntries()
            : blockManager.getBlockEntries().filter((entry) => entry.active);
        const targets = [];

        for (const position of positions) {
            const matchedEntry = allEntries.find((entry) => isPointInsideEntry(position, entry));
            if (matchedEntry) {
                targets.push(matchedEntry);
            }
        }

        deleteBlocks(targets);
    }

    function updateMovedFlag(event) {
        if (!pointerState) return;
        const dx = event.clientX - pointerState.startX;
        const dy = event.clientY - pointerState.startY;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
            pointerState.moved = true;
        }
    }

    function beginPointerInteraction(event) {
        if (state.workMode !== 'classic') return;
        if (!isMouseEditMode()) return;
        if (event.button !== 0 && event.button !== 2) return;
        pointerState = {
            button: event.button,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
            isContextAction: event.button === 2 || (event.button === 0 && event.ctrlKey)
        };
    }

    function updatePointerInteraction(event) {
        updateMovedFlag(event);
        updatePixelPreviewFromEvent(event);
    }

    function finishPointerInteraction(event) {
        if (!pointerState) return;
        if (state.workMode !== 'classic') return;
        if (!isMouseEditMode()) return;

        updateMovedFlag(event);
        if (pointerState.moved) {
            pointerState = null;
            return;
        }
        if (event.button !== pointerState.button) return;

        updateMouse(event);
        if (!pointerState.isContextAction && pointerState.button === 0) {
            pointerState = null;
            handleLeftClick();
            return;
        }
    }

    function cancelPointerInteraction() {
        pointerState = null;
    }

    function handlePointerLeave(event) {
        hidePixelPreview();
        if (!pointerState) return;
        updateMovedFlag(event);
        if (pointerState.moved) {
            pointerState = null;
        }
    }

    function onContextMenu(event) {
        if (state.workMode !== 'classic') return;
        if (!isMouseEditMode()) return;

        event.preventDefault();
        updateMouse(event);
        updateMovedFlag(event);

        if (pointerState && pointerState.isContextAction && !pointerState.moved) {
            if (isPixelMode()) {
                handlePixelErase();
            } else {
                handleRightClick();
            }
        }
        pointerState = null;
        updatePixelPreviewFromEvent(event);
    }

    renderer.domElement.addEventListener('pointerdown', beginPointerInteraction);
    renderer.domElement.addEventListener('pointermove', updatePointerInteraction);
    renderer.domElement.addEventListener('pointerup', finishPointerInteraction);
    renderer.domElement.addEventListener('pointercancel', cancelPointerInteraction);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    return {
        dispose: () => {
            hidePixelPreview();
            renderer.domElement.removeEventListener('pointerdown', beginPointerInteraction);
            renderer.domElement.removeEventListener('pointermove', updatePointerInteraction);
            renderer.domElement.removeEventListener('pointerup', finishPointerInteraction);
            renderer.domElement.removeEventListener('pointercancel', cancelPointerInteraction);
            renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
            renderer.domElement.removeEventListener('contextmenu', onContextMenu);
            if (previewHost) {
                previewHost.remove(pixelPreviewGroup);
            }
            pixelPreviewGeometry.dispose();
            pixelPreviewMaterial.dispose();
        }
    };
}
