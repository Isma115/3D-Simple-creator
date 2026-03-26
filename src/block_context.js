import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export function attachBlockContextMenu({ scene, camera, renderer, controls, state, blockManager, undoManager, onUpdate }) {
    if (!blockManager) return { dispose: () => {} };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const CLICK_THRESHOLD_PX = 6;
    const DOUBLE_CLICK_DELAY_MS = 350;
    let currentEntry = null;
    let pointerState = null;
    let lastClickInfo = null;

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.display = 'none';

    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = 'Dividir';
    menu.appendChild(action);

    document.body.appendChild(menu);

    const transformControl = new TransformControls(camera, renderer.domElement);
    transformControl.addEventListener('dragging-changed', function (event) {
        if (controls) controls.enabled = !event.value;
    });
    scene.add(transformControl);

    let displacingEntry = null;
    let positionBeforeDisplace = null;

    function finishDisplacement() {
        if (!displacingEntry) return;

        transformControl.detach();

        const positionAfter = displacingEntry.mesh.position.clone();

        // Solo guardamos y actualizamos si realmente se ha movido (tolerancia leve)
        if (positionAfter.distanceToSquared(positionBeforeDisplace) > 0.0001) {
            blockManager.updateBlockPosition(displacingEntry, positionAfter);

            undoManager.pushAction({
                kind: 'block-move',
                entry: displacingEntry,
                positionBefore: positionBeforeDisplace.clone(),
                positionAfter: positionAfter.clone()
            });
            onUpdate();
        }

        displacingEntry = null;
        positionBeforeDisplace = null;
    }

    function onKeyDown(event) {
        if (displacingEntry && (event.key === 'Enter' || event.key === 'Escape')) {
            finishDisplacement();
        }
    }

    window.addEventListener('keydown', onKeyDown);

    function updateMouse(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickBlockEntry() {
        const entries = blockManager.getBlockEntries().filter((entry) => entry.active);
        if (entries.length === 0) return null;
        const meshes = entries.map((entry) => entry.mesh);
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length === 0) return null;
        return blockManager.getBlockByMesh(hits[0].object) ?? null;
    }

    function hideMenu() {
        currentEntry = null;
        menu.style.display = 'none';
    }

    function selectEntry(entry) {
        if (!entry) return;
        if (state.selectedBlock && state.selectedBlock !== entry) {
            blockManager.setSelected(state.selectedBlock, false);
        }
        state.selectedBlock = entry;
        blockManager.setSelected(entry, true);
        state.currentPosition.copy(entry.position);
        state.cursorMesh.position.copy(state.currentPosition);
        state.pathPoints = [state.currentPosition.clone()];
    }

    function startDisplacement(entry) {
        if (!entry || !entry.active) return;
        if (displacingEntry === entry) return;

        if (displacingEntry) {
            finishDisplacement();
        }

        selectEntry(entry);
        displacingEntry = entry;
        positionBeforeDisplace = entry.position.clone();
        transformControl.attach(entry.mesh);
    }

    function showMenu(x, y, entry) {
        currentEntry = entry;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';
    }

    function onContextMenu(event) {
        if (state.workMode !== 'classic') {
            hideMenu();
            return;
        }
        if (state.controlMode !== 'blocks-keyboard') {
            hideMenu();
            return;
        }
        event.preventDefault();
        updateMouse(event);
        const entry = pickBlockEntry();
        if (!entry) {
            hideMenu();
            return;
        }
        showMenu(event.clientX + 6, event.clientY + 6, entry);
    }

    function onDocumentPointerDown(event) {
        if (displacingEntry) {
            // Si está arrastrando el gizmo o el ratón está sobre él, no hacer nada
            if (transformControl.dragging || transformControl.axis !== null) return;

            // Si el click fue fuera de la figura seleccionada o del gizmo, terminar el desplazamiento
            finishDisplacement();
        }

        if (menu.style.display === 'none') return;
        if (menu.contains(event.target)) return;
        hideMenu();
    }

    function beginPointerInteraction(event) {
        if (state.workMode !== 'classic') return;
        if (state.controlMode !== 'blocks-keyboard') return;
        if (event.button !== 0) return;
        pointerState = {
            startX: event.clientX,
            startY: event.clientY,
            moved: false
        };
    }

    function updatePointerInteraction(event) {
        if (!pointerState) return;
        const dx = event.clientX - pointerState.startX;
        const dy = event.clientY - pointerState.startY;
        if (Math.hypot(dx, dy) > CLICK_THRESHOLD_PX) {
            pointerState.moved = true;
        }
    }

    function onPointerUp(event) {
        if (!pointerState) return;
        const currentPointer = pointerState;
        pointerState = null;

        if (state.workMode !== 'classic') return;
        if (state.controlMode !== 'blocks-keyboard') return;
        if (event.button !== 0) return;
        if (currentPointer.moved) {
            lastClickInfo = null;
            return;
        }
        if (transformControl.dragging || transformControl.axis !== null) {
            lastClickInfo = null;
            return;
        }

        updateMouse(event);
        const entry = pickBlockEntry();
        if (!entry) {
            lastClickInfo = null;
            return;
        }

        const now = performance.now();
        if (
            lastClickInfo
            && lastClickInfo.entry === entry
            && (now - lastClickInfo.time) <= DOUBLE_CLICK_DELAY_MS
        ) {
            lastClickInfo = null;
            startDisplacement(entry);
            return;
        }

        lastClickInfo = { entry, time: now };
    }

    function cancelPointerInteraction() {
        pointerState = null;
        lastClickInfo = null;
    }

    action.addEventListener('click', () => {
        if (!currentEntry) return;
        const cursorBefore = state.currentPosition.clone();
        const sizeBefore = state.currentBlockSize;
        const result = blockManager.splitBlock(currentEntry);
        if (!result) {
            hideMenu();
            return;
        }

        // Snap the current position to the center of the first child
        state.currentBlockSize = result.childSize;
        const offset = state.currentBlockSize / 2;
        state.currentPosition.set(
            currentEntry.position.x - offset,
            currentEntry.position.y - offset,
            currentEntry.position.z - offset
        );
        state.cursorMesh.position.copy(state.currentPosition);

        undoManager.pushAction({
            kind: 'block-split',
            parentEntry: result.parent,
            childEntries: result.children,
            cursorBefore,
            sizeBefore,
            cursorAfter: state.currentPosition.clone(),
            sizeAfter: state.currentBlockSize
        });
        onUpdate();
        hideMenu();
    });

    renderer.domElement.addEventListener('pointerdown', beginPointerInteraction);
    renderer.domElement.addEventListener('pointermove', updatePointerInteraction);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', cancelPointerInteraction);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerdown', onDocumentPointerDown);

    return {
        dispose: () => {
            renderer.domElement.removeEventListener('pointerdown', beginPointerInteraction);
            renderer.domElement.removeEventListener('pointermove', updatePointerInteraction);
            renderer.domElement.removeEventListener('pointerup', onPointerUp);
            renderer.domElement.removeEventListener('pointercancel', cancelPointerInteraction);
            renderer.domElement.removeEventListener('contextmenu', onContextMenu);
            document.removeEventListener('pointerdown', onDocumentPointerDown);
            window.removeEventListener('keydown', onKeyDown);
            menu.remove();
            if (transformControl.parent) {
                transformControl.parent.remove(transformControl);
            }
            transformControl.dispose();
        }
    };
}
