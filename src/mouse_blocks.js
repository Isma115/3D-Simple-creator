import * as THREE from 'three';

export function attachMouseBlockControls({ camera, renderer, state, blockManager, undoManager, onUpdate }) {
    if (!blockManager) return { dispose: () => {} };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const DRAG_THRESHOLD_PX = 6;
    let pointerState = null;

    function updateMouse(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function snapToSize(value, size) {
        return Math.round(value / size) * size;
    }

    function getBlockHit() {
        const entries = blockManager.getBlockEntries().filter((entry) => entry.active);
        if (entries.length === 0) return null;
        const meshes = entries.map((entry) => entry.mesh);
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(meshes, false);
        return hits.length > 0 ? hits[0] : null;
    }

    function selectBlockEntry(entry) {
        if (!entry) return;
        if (state.hoveredBlock && state.hoveredBlock !== entry) {
            blockManager.setHovered(state.hoveredBlock, false);
            state.hoveredBlock = null;
        }
        blockManager.setSelection([entry], entry);
    }

    function placeBlock(position, size = 1) {
        const cursorBefore = state.currentPosition.clone();
        const sizeBefore = state.currentBlockSize;
        const { entry, created } = blockManager.registerBlock(position, size);
        state.currentBlockSize = size;
        state.currentPosition.copy(entry.position);
        state.cursorMesh.position.copy(state.currentPosition);
        state.pathPoints = [state.currentPosition.clone()];
        selectBlockEntry(entry);
        if (created) {
            undoManager.pushAction({
                kind: 'block-add',
                blockEntries: [entry],
                cursorBefore,
                sizeBefore,
                cursorAfter: entry.position.clone(),
                sizeAfter: size
            });
        }
        onUpdate();
    }

    function deleteBlock(entry) {
        if (!entry || !entry.active) return;
        entry.active = false;
        blockManager.refreshEntryVisibility(entry);
        blockManager.removeFromSelection(entry);
        if (state.hoveredBlock === entry) {
            blockManager.setHovered(entry, false);
            state.hoveredBlock = null;
        }
        undoManager.pushAction({
            kind: 'block-delete',
            blockEntries: [entry]
        });
        onUpdate();
    }

    function handleLeftClick() {
        const hit = getBlockHit();
        if (!hit) return;
        const entry = blockManager.getBlockByMesh(hit.object);
        deleteBlock(entry);
    }

    function handleRightClick() {
        const hit = getBlockHit();
        if (hit && hit.face) {
            const entry = blockManager.getBlockByMesh(hit.object);
            const faceNormal = hit.face.normal.clone().applyQuaternion(hit.object.quaternion);
            const size = entry ? entry.size ?? 1 : 1;
            const targetPosition = hit.object.position.clone().add(faceNormal.multiplyScalar(size));
            placeBlock(new THREE.Vector3(
                snapToSize(targetPosition.x, size),
                snapToSize(targetPosition.y, size),
                snapToSize(targetPosition.z, size)
            ), size);
            return;
        }
        raycaster.setFromCamera(mouse, camera);
        const groundHit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(groundPlane, groundHit)) {
            const size = state.currentBlockSize;
            placeBlock(new THREE.Vector3(
                snapToSize(groundHit.x, size),
                Math.max(size / 2, snapToSize(groundHit.y, size)), // prevent sinking below ground
                snapToSize(groundHit.z, size)
            ), size);
        }
    }

    function beginPointerInteraction(event) {
        if (state.workMode !== 'classic') return;
        if (state.controlMode !== 'blocks-mouse') return;
        if (event.button !== 0 && event.button !== 2) return;
        pointerState = {
            button: event.button,
            startX: event.clientX,
            startY: event.clientY,
            moved: false
        };
    }

    function updatePointerInteraction(event) {
        if (!pointerState) return;
        const dx = event.clientX - pointerState.startX;
        const dy = event.clientY - pointerState.startY;
        if (Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
            pointerState.moved = true;
        }
    }

    function finishPointerInteraction(event) {
        if (!pointerState) return;
        const current = pointerState;
        pointerState = null;

        if (state.workMode !== 'classic') return;
        if (state.controlMode !== 'blocks-mouse') return;
        if (current.moved) return;
        if (event.button !== current.button) return;

        updateMouse(event);
        if (current.button === 0) {
            handleLeftClick();
            return;
        }
        if (current.button === 2) {
            handleRightClick();
        }
    }

    function cancelPointerInteraction() {
        pointerState = null;
    }

    function handlePointerLeave() {
        if (pointerState?.moved) {
            pointerState = null;
        }
    }

    function onContextMenu(event) {
        if (state.workMode !== 'classic') return;
        if (state.controlMode === 'blocks-mouse') {
            event.preventDefault();
        }
    }

    renderer.domElement.addEventListener('pointerdown', beginPointerInteraction);
    renderer.domElement.addEventListener('pointermove', updatePointerInteraction);
    renderer.domElement.addEventListener('pointerup', finishPointerInteraction);
    renderer.domElement.addEventListener('pointercancel', cancelPointerInteraction);
    renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    return {
        dispose: () => {
            renderer.domElement.removeEventListener('pointerdown', beginPointerInteraction);
            renderer.domElement.removeEventListener('pointermove', updatePointerInteraction);
            renderer.domElement.removeEventListener('pointerup', finishPointerInteraction);
            renderer.domElement.removeEventListener('pointercancel', cancelPointerInteraction);
            renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
            renderer.domElement.removeEventListener('contextmenu', onContextMenu);
        }
    };
}
