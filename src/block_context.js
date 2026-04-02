import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export function attachBlockContextMenu({ scene, camera, renderer, controls, state, blockManager, undoManager, onUpdate }) {
    if (!blockManager) return { dispose: () => {} };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const CLICK_THRESHOLD_PX = 6;
    const DOUBLE_CLICK_DELAY_MS = 350;
    const UNIFORM_SCALE_SENSITIVITY = 0.22;
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

    const mergeAction = document.createElement('button');
    mergeAction.type = 'button';
    mergeAction.textContent = 'Fusionar seleccion';
    menu.appendChild(mergeAction);

    const resizeAction = document.createElement('button');
    resizeAction.type = 'button';
    resizeAction.textContent = 'Redimensionar';
    menu.appendChild(resizeAction);

    const selectHorizontalRowAction = document.createElement('button');
    selectHorizontalRowAction.type = 'button';
    selectHorizontalRowAction.textContent = 'Seleccionar fila vecina (horizontal)';
    menu.appendChild(selectHorizontalRowAction);

    const selectVerticalRowAction = document.createElement('button');
    selectVerticalRowAction.type = 'button';
    selectVerticalRowAction.textContent = 'Seleccionar fila vecina (vertical)';
    menu.appendChild(selectVerticalRowAction);

    document.body.appendChild(menu);

    const transformControl = new TransformControls(camera, renderer.domElement);
    transformControl.addEventListener('dragging-changed', function (event) {
        if (controls) controls.enabled = !event.value;
    });
    transformControl.addEventListener('objectChange', () => {
        if (!transformingEntry) return;
        if (transformMode !== 'scale') return;

        if (transformControl.axis === 'XYZ' && transformStartScale) {
            const rawUniformScale = (
                transformingEntry.mesh.scale.x
                + transformingEntry.mesh.scale.y
                + transformingEntry.mesh.scale.z
            ) / 3;
            const startUniformScale = (
                transformStartScale.x
                + transformStartScale.y
                + transformStartScale.z
            ) / 3;
            const adjustedUniformScale = Math.max(
                0.02,
                startUniformScale + ((rawUniformScale - startUniformScale) * UNIFORM_SCALE_SENSITIVITY)
            );
            transformingEntry.mesh.scale.set(adjustedUniformScale, adjustedUniformScale, adjustedUniformScale);
        }

        const baseSize = scaleBaseDimensions ?? transformingEntry.dimensions ?? new THREE.Vector3(1, 1, 1);
        const startScale = transformStartScale ?? new THREE.Vector3(1, 1, 1);
        const scaleRatioX = Math.abs(startScale.x) > 1e-8 ? transformingEntry.mesh.scale.x / startScale.x : 1;
        const scaleRatioY = Math.abs(startScale.y) > 1e-8 ? transformingEntry.mesh.scale.y / startScale.y : 1;
        const scaleRatioZ = Math.abs(startScale.z) > 1e-8 ? transformingEntry.mesh.scale.z / startScale.z : 1;
        transformingEntry.dimensions = new THREE.Vector3(
            Math.abs(baseSize.x * scaleRatioX),
            Math.abs(baseSize.y * scaleRatioY),
            Math.abs(baseSize.z * scaleRatioZ)
        );
    });
    scene.add(transformControl);

    let transformingEntry = null;
    let transformMode = 'translate';
    let positionBeforeDisplace = null;
    let dimensionsBeforeTransform = null;
    let sizeBeforeTransform = null;
    let scaleBaseDimensions = null;
    let transformStartScale = null;
    const WORLD_AXES = ['x', 'y', 'z'];

    function getTargetEntries(preferredEntry = null, { hoveredFirst = false } = {}) {
        const selectedEntries = blockManager.getSelectedEntries().filter((entry) => entry?.active);
        const hoveredEntry = state.hoveredBlock?.active ? state.hoveredBlock : null;

        if (hoveredFirst && hoveredEntry) {
            return selectedEntries.includes(hoveredEntry) ? selectedEntries : [hoveredEntry];
        }
        if (preferredEntry?.active) {
            return selectedEntries.includes(preferredEntry) ? selectedEntries : [preferredEntry];
        }
        if (selectedEntries.length > 0) {
            return selectedEntries;
        }
        return hoveredEntry ? [hoveredEntry] : [];
    }

    function getPrimarySplitResult(splitResults) {
        if (splitResults.length === 0) return null;
        const selectedResult = splitResults.find((result) => result.parent === state.selectedBlock);
        return selectedResult ?? splitResults[splitResults.length - 1];
    }

    function pickAxisFromVector(vector, excludedAxes = []) {
        const rankedAxes = WORLD_AXES
            .map((axis) => ({ axis, value: Math.abs(vector[axis]) }))
            .sort((left, right) => right.value - left.value);
        for (const axisData of rankedAxes) {
            if (!excludedAxes.includes(axisData.axis)) {
                return axisData.axis;
            }
        }
        return rankedAxes[0]?.axis ?? 'x';
    }

    function getCameraRowAxes() {
        const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
        const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
        const horizontalAxis = pickAxisFromVector(rightVector);
        const verticalAxis = pickAxisFromVector(upVector, [horizontalAxis]);
        return { horizontalAxis, verticalAxis };
    }

    function getEntryAxisSize(entry, axis) {
        if (entry?.dimensions?.isVector3) {
            return Math.max(Math.abs(entry.dimensions[axis]), 1e-4);
        }
        return Math.max(Math.abs(entry?.size ?? 1), 1e-4);
    }

    function buildContiguousRow(entry, rowAxis) {
        if (!entry?.active || entry.geometryType !== 'cube') return [];

        const entrySize = getEntryAxisSize(entry, rowAxis);
        const crossAxes = WORLD_AXES.filter((axis) => axis !== rowAxis);
        const positionTolerance = entrySize * 0.25;
        const allEntries = (blockManager.getActiveBlockEntries
            ? blockManager.getActiveBlockEntries()
            : blockManager.getBlockEntries().filter((candidate) => candidate?.active))
            .filter((candidate) => candidate.geometryType === 'cube');

        const rowCandidates = allEntries.filter((candidate) => (
            Math.abs(candidate.position[crossAxes[0]] - entry.position[crossAxes[0]]) <= positionTolerance
            && Math.abs(candidate.position[crossAxes[1]] - entry.position[crossAxes[1]]) <= positionTolerance
        ));
        if (rowCandidates.length === 0) return [entry];

        const candidateByIndex = new Map();
        for (const candidate of rowCandidates) {
            const index = Math.round((candidate.position[rowAxis] - entry.position[rowAxis]) / entrySize);
            const current = candidateByIndex.get(index);
            if (!current) {
                candidateByIndex.set(index, candidate);
                continue;
            }
            const currentDistance = Math.abs(current.position[rowAxis] - (entry.position[rowAxis] + (index * entrySize)));
            const candidateDistance = Math.abs(candidate.position[rowAxis] - (entry.position[rowAxis] + (index * entrySize)));
            if (candidateDistance < currentDistance) {
                candidateByIndex.set(index, candidate);
            }
        }

        const selected = [];
        const centerCandidate = candidateByIndex.get(0) ?? entry;
        selected.push(centerCandidate);

        for (let index = -1; candidateByIndex.has(index); index -= 1) {
            selected.push(candidateByIndex.get(index));
        }
        for (let index = 1; candidateByIndex.has(index); index += 1) {
            selected.push(candidateByIndex.get(index));
        }

        return selected.filter((candidate, index, list) => list.indexOf(candidate) === index);
    }

    function selectNeighborRowByCamera(entry, direction = 'horizontal') {
        if (!entry?.active || entry.geometryType !== 'cube') return false;

        const { horizontalAxis, verticalAxis } = getCameraRowAxes();
        const axis = direction === 'vertical' ? verticalAxis : horizontalAxis;
        const rowSelection = buildContiguousRow(entry, axis);
        if (rowSelection.length === 0) return false;

        blockManager.setSelection(rowSelection, entry);
        state.currentPosition.copy(entry.position);
        state.cursorMesh.position.copy(state.currentPosition);
        state.pathPoints = [state.currentPosition.clone()];
        onUpdate();
        hideMenu();
        return true;
    }

    function finishTransform() {
        if (!transformingEntry) return;

        transformControl.detach();

        if (transformMode === 'scale') {
            const dimensionsAfter = transformingEntry.dimensions.clone();
            if (dimensionsBeforeTransform && dimensionsAfter.distanceToSquared(dimensionsBeforeTransform) > 0.0001) {
                const nextSize = (
                    Math.abs(dimensionsAfter.x - dimensionsAfter.y) <= 1e-4
                    && Math.abs(dimensionsAfter.x - dimensionsAfter.z) <= 1e-4
                ) ? dimensionsAfter.x : sizeBeforeTransform;
                blockManager.updateBlockDimensions(transformingEntry, dimensionsAfter, nextSize);
                undoManager.pushAction({
                    kind: 'block-resize',
                    entry: transformingEntry,
                    dimensionsBefore: dimensionsBeforeTransform.clone(),
                    dimensionsAfter: dimensionsAfter.clone(),
                    sizeBefore: sizeBeforeTransform,
                    sizeAfter: transformingEntry.size
                });
                onUpdate();
            }

            transformingEntry = null;
            dimensionsBeforeTransform = null;
            sizeBeforeTransform = null;
            scaleBaseDimensions = null;
            transformStartScale = null;
            positionBeforeDisplace = null;
            transformMode = 'translate';
            return;
        }

        const positionAfter = transformingEntry.mesh.position.clone();
        if (positionBeforeDisplace && positionAfter.distanceToSquared(positionBeforeDisplace) > 0.0001) {
            blockManager.updateBlockPosition(transformingEntry, positionAfter);
            undoManager.pushAction({
                kind: 'block-move',
                entry: transformingEntry,
                positionBefore: positionBeforeDisplace.clone(),
                positionAfter: positionAfter.clone()
            });
            onUpdate();
        }

        transformingEntry = null;
        positionBeforeDisplace = null;
        dimensionsBeforeTransform = null;
        sizeBeforeTransform = null;
        scaleBaseDimensions = null;
        transformStartScale = null;
        transformMode = 'translate';
    }

    function onKeyDown(event) {
        if (transformingEntry && (event.key === 'Enter' || event.key === 'Escape')) {
            finishTransform();
            return;
        }

        if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey) {
            return;
        }
        if (event.code !== 'KeyD') return;
        if (state.workMode !== 'classic') return;
        if (
            state.controlMode !== 'blocks-keyboard'
            && state.controlMode !== 'blocks-mouse'
            && state.controlMode !== 'blocks-pixel'
        ) return;

        const targets = getTargetEntries(null, { hoveredFirst: true });
        if (targets.length === 0) return;

        event.preventDefault();
        event.stopPropagation();
        performSplit(targets);
    }

    function performSplit(entriesOrEntry) {
        const requestedEntries = Array.isArray(entriesOrEntry)
            ? entriesOrEntry
            : getTargetEntries(entriesOrEntry);
        const targets = requestedEntries.filter((entry, index, list) => (
            entry?.active
            && blockManager.canSplitBlock(entry)
            && list.indexOf(entry) === index
        ));
        if (targets.length === 0) {
            hideMenu();
            return false;
        }

        const cursorBefore = state.currentPosition.clone();
        const sizeBefore = state.currentBlockSize;
        const splitResults = [];

        for (const entry of targets) {
            const result = blockManager.splitBlock(entry);
            if (result) {
                splitResults.push(result);
            }
        }

        if (splitResults.length === 0) {
            hideMenu();
            return false;
        }

        const childEntries = splitResults.flatMap((result) => result.children);
        const parentEntries = splitResults.map((result) => result.parent);
        const primaryResult = getPrimarySplitResult(splitResults);
        const primaryChild = primaryResult?.children?.[0] ?? childEntries[0] ?? null;

        // Snap the current position to the center of the first child
        state.currentBlockSize = primaryResult?.childSize ?? sizeBefore;
        const offset = state.currentBlockSize / 2;
        state.currentPosition.set(
            primaryResult.parent.position.x - offset,
            primaryResult.parent.position.y - offset,
            primaryResult.parent.position.z - offset
        );
        state.cursorMesh.position.copy(state.currentPosition);
        state.pathPoints = [state.currentPosition.clone()];

        if (state.hoveredBlock && !state.hoveredBlock.active) {
            state.hoveredBlock = null;
        }
        blockManager.setSelection(childEntries, primaryChild);

        undoManager.pushAction({
            kind: 'block-split',
            parentEntries,
            childEntries,
            cursorBefore,
            sizeBefore,
            cursorAfter: state.currentPosition.clone(),
            sizeAfter: state.currentBlockSize
        });
        onUpdate();
        hideMenu();
        return true;
    }

    window.addEventListener('keydown', onKeyDown);

    function updateMouse(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickBlockEntry() {
        const meshes = blockManager.getActiveBlockMeshes
            ? blockManager.getActiveBlockMeshes()
            : blockManager.getBlockEntries().filter((entry) => entry.active).map((entry) => entry.mesh);
        if (meshes.length === 0) return null;
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
        blockManager.setSelection([entry], entry);
        state.currentPosition.copy(entry.position);
        state.cursorMesh.position.copy(state.currentPosition);
        state.pathPoints = [state.currentPosition.clone()];
    }

    function startTransform(entry, mode = 'translate') {
        if (!entry || !entry.active) return;
        if (transformingEntry === entry && transformMode === mode) return;

        if (transformingEntry) {
            finishTransform();
        }

        const selectedEntries = blockManager.getSelectedEntries();
        if (!selectedEntries.includes(entry)) {
            selectEntry(entry);
        } else {
            state.currentPosition.copy(entry.position);
            state.cursorMesh.position.copy(state.currentPosition);
            state.pathPoints = [state.currentPosition.clone()];
        }
        transformingEntry = entry;
        transformMode = mode;
        positionBeforeDisplace = entry.position.clone();
        dimensionsBeforeTransform = entry.dimensions.clone();
        sizeBeforeTransform = entry.size ?? null;
        scaleBaseDimensions = entry.dimensions.clone();
        transformStartScale = entry.mesh.scale.clone();
        transformControl.setMode(mode);
        transformControl.setSpace(mode === 'scale' ? 'local' : 'world');
        transformControl.showX = true;
        transformControl.showY = true;
        transformControl.showZ = true;
        transformControl.attach(entry.mesh);
    }

    function showMenu(x, y, entry) {
        currentEntry = entry;
        const targets = getTargetEntries(entry);
        const splittableTargets = targets.filter((target) => blockManager.canSplitBlock(target));
        const mergeableTargets = targets.filter((target) => target?.active);
        action.disabled = splittableTargets.length === 0;
        if (splittableTargets.length === 0) {
            action.textContent = 'No divisible';
        } else if (targets.length > 1) {
            action.textContent = 'Dividir seleccion';
        } else {
            action.textContent = 'Dividir';
        }
        mergeAction.disabled = mergeableTargets.length < 2;
        resizeAction.disabled = !entry?.active;
        const rowSelectionDisabled = !entry?.active || entry?.geometryType !== 'cube';
        selectHorizontalRowAction.disabled = rowSelectionDisabled;
        selectVerticalRowAction.disabled = rowSelectionDisabled;
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
        if (transformingEntry) {
            // Si está arrastrando el gizmo o el ratón está sobre él, no hacer nada
            if (transformControl.dragging || transformControl.axis !== null) return;

            // Si el click fue fuera de la figura seleccionada o del gizmo, terminar el desplazamiento
            finishTransform();
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
            startTransform(entry, 'translate');
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
        performSplit(currentEntry);
    });

    mergeAction.addEventListener('click', () => {
        const targets = getTargetEntries(currentEntry);
        if (targets.length < 2) return;
        hideMenu();
        document.getElementById('merge-selected-blocks-button')?.click();
    });

    resizeAction.addEventListener('click', () => {
        if (!currentEntry) return;
        const targetEntry = currentEntry;
        hideMenu();
        startTransform(targetEntry, 'scale');
    });

    selectHorizontalRowAction.addEventListener('click', () => {
        if (!currentEntry) return;
        selectNeighborRowByCamera(currentEntry, 'horizontal');
    });

    selectVerticalRowAction.addEventListener('click', () => {
        if (!currentEntry) return;
        selectNeighborRowByCamera(currentEntry, 'vertical');
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
