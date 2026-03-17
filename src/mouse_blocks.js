import * as THREE from 'three';

export function attachMouseBlockControls({ camera, renderer, state, blockManager, undoManager, onUpdate }) {
    if (!blockManager) return { dispose: () => {} };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

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

    function placeBlock(position, size = 1) {
        const cursorBefore = state.currentPosition.clone();
        const { entry, created } = blockManager.registerBlock(position, size);
        state.currentPosition.copy(entry.position);
        state.cursorMesh.position.copy(state.currentPosition);
        state.pathPoints = [state.currentPosition.clone()];
        if (created) {
            undoManager.pushAction({
                kind: 'block-add',
                blockEntries: [entry],
                cursorBefore,
                cursorAfter: entry.position.clone()
            });
        }
        onUpdate();
    }

    function deleteBlock(entry) {
        if (!entry || !entry.active) return;
        entry.active = false;
        blockManager.refreshEntryVisibility(entry);
        if (state.selectedBlock === entry) {
            blockManager.setSelected(entry, false);
            state.selectedBlock = null;
        }
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
            placeBlock(new THREE.Vector3(
                Math.round(groundHit.x),
                0,
                Math.round(groundHit.z)
            ));
        }
    }

    function onMouseDown(event) {
        if (state.controlMode !== 'blocks-mouse') return;
        updateMouse(event);
        if (event.button === 0) {
            handleLeftClick();
        } else if (event.button === 2) {
            handleRightClick();
        }
    }

    function onContextMenu(event) {
        if (state.controlMode === 'blocks-mouse') {
            event.preventDefault();
        }
    }

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    return {
        dispose: () => {
            renderer.domElement.removeEventListener('mousedown', onMouseDown);
            renderer.domElement.removeEventListener('contextmenu', onContextMenu);
        }
    };
}
