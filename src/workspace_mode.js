import * as THREE from 'three';
import { drawLineBetweenPoints } from './input.js';
import { getVertexKey, pointsEqual } from './geometry.js';

const VIEW_THRESHOLD_PX = 18;
const ORTHO_PADDING = 3;

function createPreviewHelpers(scene) {
    const previewLine = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({
            color: 0xffc266,
            transparent: true,
            opacity: 0.9,
            depthTest: false
        })
    );
    previewLine.renderOrder = 6;
    previewLine.visible = false;
    scene.add(previewLine);

    const previewPoint = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 12),
        new THREE.MeshBasicMaterial({
            color: 0xffc266,
            transparent: true,
            opacity: 0.95,
            depthTest: false
        })
    );
    previewPoint.renderOrder = 7;
    previewPoint.visible = false;
    scene.add(previewPoint);

    return { previewLine, previewPoint };
}

function getStateBounds(state, blockManager) {
    const bounds = new THREE.Box3();
    let hasContent = false;

    for (const position of state.vertexPositions.values()) {
        bounds.expandByPoint(position);
        hasContent = true;
    }

    if (blockManager?.getBlockEntries) {
        for (const entry of blockManager.getBlockEntries()) {
            if (!entry.active) continue;
            const size = entry.size ?? 1;
            const halfSize = size / 2;
            bounds.expandByPoint(entry.position.clone().addScalar(halfSize));
            bounds.expandByPoint(entry.position.clone().addScalar(-halfSize));
            hasContent = true;
        }
    }

    if (!hasContent) {
        bounds.expandByPoint(state.currentPosition.clone().addScalar(2));
        bounds.expandByPoint(state.currentPosition.clone().addScalar(-2));
    }

    return bounds;
}

function applyOrthographicFrame(camera, aspect, radius) {
    camera.left = -radius * aspect;
    camera.right = radius * aspect;
    camera.top = radius;
    camera.bottom = -radius;
    camera.near = 0.1;
    camera.far = Math.max(radius * 16, 100);
    camera.updateProjectionMatrix();
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function createWorkspaceModeController({
    scene,
    camera,
    renderer,
    controls,
    state,
    entryManager,
    faceController,
    graphManager,
    blockManager,
    undoManager,
    onUpdate
}) {
    const root = document.getElementById('blueprint-workspace');
    const panels = {
        top: document.getElementById('blueprint-view-top'),
        right: document.getElementById('blueprint-view-right'),
        left: document.getElementById('blueprint-view-left'),
        bottom: document.getElementById('blueprint-view-bottom'),
        preview: document.getElementById('blueprint-preview-panel')
    };
    const labels = {
        top: document.getElementById('blueprint-depth-top'),
        right: document.getElementById('blueprint-depth-right'),
        left: document.getElementById('blueprint-depth-left'),
        bottom: document.getElementById('blueprint-depth-bottom'),
        preview: document.getElementById('blueprint-preview-status')
    };

    const raycaster = new THREE.Raycaster();
    const previewCamera = new THREE.PerspectiveCamera(camera.fov, 1, camera.near, camera.far);
    const orthoCameras = {
        top: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200),
        right: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200),
        left: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200),
        bottom: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    };
    const { previewLine, previewPoint } = createPreviewHelpers(scene);

    let hoveredEntry = null;
    let hoveredViewKey = null;
    let hoveredPoint = null;

    const viewMeta = {
        top: { label: 'Plano Y', depthAxis: 'y', planeAxis: 'y', camera: orthoCameras.top },
        right: { label: 'Plano X', depthAxis: 'x', planeAxis: 'x', camera: orthoCameras.right },
        left: { label: 'Plano X', depthAxis: 'x', planeAxis: 'x', camera: orthoCameras.left },
        bottom: { label: 'Plano Y', depthAxis: 'y', planeAxis: 'y', camera: orthoCameras.bottom }
    };

    function clearHoveredPoint() {
        if (!hoveredEntry) return;
        entryManager.setHovered(hoveredEntry, false);
        hoveredEntry = null;
    }

    function clearPreviewHelpers() {
        previewLine.visible = false;
        previewPoint.visible = false;
        hoveredPoint = null;
        hoveredViewKey = null;
    }

    function clearPointSelection() {
        if (state.selectedEntry) {
            entryManager.setSelected(state.selectedEntry, false);
        }
        for (const key of state.selectedPointKeys) {
            entryManager.setMultiSelectedByKey(key, false);
        }
        state.selectedEntry = null;
        state.selectedPointKeys = [];
    }

    function getPointEntryByKey(key) {
        if (!key) return null;
        for (const entry of entryManager.getPointEntriesByKey(key)) {
            if (entry.active) return entry;
        }
        return null;
    }

    function selectPointByKey(key) {
        const position = state.vertexPositions.get(key);
        if (!position) return;
        clearHoveredPoint();
        clearPointSelection();
        const entry = getPointEntryByKey(key);
        if (entry) {
            entryManager.setSelected(entry, true);
            state.selectedEntry = entry;
        }
        state.selectedPointKeys = [key];
        entryManager.setMultiSelectedByKey(key, true);
        state.currentPosition.copy(position);
        state.cursorMesh.position.copy(position);
        state.pathPoints = [position.clone()];
    }

    function moveCursorTo(point) {
        clearPointSelection();
        state.currentPosition.copy(point);
        state.cursorMesh.position.copy(point);
        state.pathPoints = [point.clone()];
    }

    function getAnchorPosition() {
        const selectedKey = state.selectedPointKeys[state.selectedPointKeys.length - 1];
        if (selectedKey && state.vertexPositions.has(selectedKey)) {
            return state.vertexPositions.get(selectedKey);
        }
        return state.currentPosition;
    }

    function hasSelectedAnchor() {
        return state.selectedPointKeys.length > 0;
    }

    function getLayout() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const margin = width < 1100 ? 16 : 24;
        const gap = width < 1100 ? 12 : 18;
        const reservedLeft = width < 1100 ? 24 : Math.min(380, width * 0.28);
        const originX = reservedLeft;
        const originY = margin;
        const workspaceWidth = Math.max(480, width - originX - margin);
        const workspaceHeight = Math.max(420, height - margin * 2);
        const previewWidth = clamp(workspaceWidth * 0.38, 260, workspaceWidth * 0.48);
        const gridWidth = workspaceWidth - previewWidth - gap;
        const cellWidth = Math.max(180, (gridWidth - gap) / 2);
        const cellHeight = Math.max(160, (workspaceHeight - gap) / 2);
        const totalGridWidth = cellWidth * 2 + gap;
        const previewHeight = cellHeight * 2 + gap;
        const offsetY = Math.max(originY, (height - previewHeight) / 2);

        const dom = {
            top: { left: originX, top: offsetY, width: cellWidth, height: cellHeight },
            right: { left: originX + cellWidth + gap, top: offsetY, width: cellWidth, height: cellHeight },
            left: { left: originX, top: offsetY + cellHeight + gap, width: cellWidth, height: cellHeight },
            bottom: { left: originX + cellWidth + gap, top: offsetY + cellHeight + gap, width: cellWidth, height: cellHeight },
            preview: { left: originX + totalGridWidth + gap, top: offsetY, width: previewWidth, height: previewHeight }
        };

        const gl = {};
        for (const [key, rect] of Object.entries(dom)) {
            gl[key] = {
                x: rect.left,
                y: height - rect.top - rect.height,
                width: rect.width,
                height: rect.height
            };
        }

        return { dom, gl };
    }

    function applyLayout(layout) {
        for (const [key, panel] of Object.entries(panels)) {
            if (!panel) continue;
            const rect = layout.dom[key];
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.width = `${rect.width}px`;
            panel.style.height = `${rect.height}px`;
        }

        const anchor = getAnchorPosition();
        labels.top.textContent = `Plano Y: ${anchor.y.toFixed(1)}`;
        labels.bottom.textContent = `Plano Y: ${anchor.y.toFixed(1)}`;
        labels.left.textContent = `Plano X: ${anchor.x.toFixed(1)}`;
        labels.right.textContent = `Plano X: ${anchor.x.toFixed(1)}`;
        labels.preview.textContent = `Cursor activo en X ${anchor.x.toFixed(1)} / Y ${anchor.y.toFixed(1)} / Z ${anchor.z.toFixed(1)}`;
    }

    function updateCameras(layout) {
        const bounds = getStateBounds(state, blockManager);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        const radius = Math.max(size.x, size.y, size.z, 4) / 2 + ORTHO_PADDING;
        const distance = radius * 4 + 8;

        for (const key of ['top', 'right', 'left', 'bottom']) {
            const rect = layout.dom[key];
            applyOrthographicFrame(orthoCameras[key], rect.width / rect.height, radius);
        }

        orthoCameras.top.position.set(center.x, center.y + distance, center.z);
        orthoCameras.top.up.set(0, 0, -1);
        orthoCameras.top.lookAt(center);

        orthoCameras.bottom.position.set(center.x, center.y - distance, center.z);
        orthoCameras.bottom.up.set(0, 0, 1);
        orthoCameras.bottom.lookAt(center);

        orthoCameras.right.position.set(center.x + distance, center.y, center.z);
        orthoCameras.right.up.set(0, 1, 0);
        orthoCameras.right.lookAt(center);

        orthoCameras.left.position.set(center.x - distance, center.y, center.z);
        orthoCameras.left.up.set(0, 1, 0);
        orthoCameras.left.lookAt(center);

        previewCamera.position.copy(camera.position);
        previewCamera.quaternion.copy(camera.quaternion);
        previewCamera.near = camera.near;
        previewCamera.far = camera.far;
        previewCamera.fov = camera.fov;
        previewCamera.aspect = layout.dom.preview.width / layout.dom.preview.height;
        previewCamera.updateProjectionMatrix();
    }

    function getViewKeyFromEvent(event, layout) {
        for (const key of ['top', 'right', 'left', 'bottom']) {
            const rect = layout.dom[key];
            const insideX = event.clientX >= rect.left && event.clientX <= rect.left + rect.width;
            const insideY = event.clientY >= rect.top && event.clientY <= rect.top + rect.height;
            if (insideX && insideY) return key;
        }
        return null;
    }

    function getSnappedPointForView(viewKey, event, layout) {
        const rect = layout.dom[viewKey];
        const ndc = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        const anchor = getAnchorPosition();
        const meta = viewMeta[viewKey];
        const plane = meta.planeAxis === 'x'
            ? new THREE.Plane(new THREE.Vector3(1, 0, 0), -anchor.x)
            : new THREE.Plane(new THREE.Vector3(0, 1, 0), -anchor.y);
        raycaster.setFromCamera(ndc, meta.camera);
        const intersection = new THREE.Vector3();
        if (!raycaster.ray.intersectPlane(plane, intersection)) {
            return null;
        }

        return new THREE.Vector3(
            Math.round(intersection.x),
            Math.round(intersection.y),
            Math.round(intersection.z)
        );
    }

    function getProjectedScreenPosition(point, cameraForView, rect) {
        const projected = point.clone().project(cameraForView);
        if (projected.z < -1 || projected.z > 1) return null;
        return {
            x: rect.left + ((projected.x + 1) / 2) * rect.width,
            y: rect.top + ((1 - projected.y) / 2) * rect.height
        };
    }

    function findNearestPoint(viewKey, event, layout) {
        const rect = layout.dom[viewKey];
        const meta = viewMeta[viewKey];
        const depth = getAnchorPosition()[meta.depthAxis];
        let closest = null;

        for (const [key, point] of state.vertexPositions.entries()) {
            const screen = getProjectedScreenPosition(point, meta.camera, rect);
            if (!screen) continue;
            const dx = screen.x - event.clientX;
            const dy = screen.y - event.clientY;
            const distance = Math.hypot(dx, dy);
            if (distance > VIEW_THRESHOLD_PX) continue;

            const depthDistance = Math.abs(point[meta.depthAxis] - depth);
            if (!closest || distance < closest.distance || (Math.abs(distance - closest.distance) < 0.01 && depthDistance < closest.depthDistance)) {
                closest = { key, point, distance, depthDistance };
            }
        }

        return closest;
    }

    function updatePreviewLine(event, viewKey, layout) {
        clearPreviewHelpers();
        if (!viewKey) return;

        const nearest = findNearestPoint(viewKey, event, layout);
        const targetPoint = nearest?.point ?? getSnappedPointForView(viewKey, event, layout);
        if (!targetPoint) return;

        hoveredViewKey = viewKey;
        hoveredPoint = targetPoint.clone();

        if (nearest) {
            const entry = getPointEntryByKey(nearest.key);
            if (entry) {
                hoveredEntry = entry;
                entryManager.setHovered(entry, true);
            }
        }

        if (!event.shiftKey && !hasSelectedAnchor()) {
            previewPoint.position.copy(targetPoint);
            previewPoint.visible = true;
            return;
        }

        const anchor = getAnchorPosition();
        if (pointsEqual(anchor, targetPoint)) {
            previewPoint.position.copy(targetPoint);
            previewPoint.visible = true;
            return;
        }

        previewLine.geometry.setFromPoints([anchor, targetPoint]);
        previewLine.visible = true;
        previewPoint.position.copy(targetPoint);
        previewPoint.visible = true;
    }

    function connectAnchorTo(targetPoint) {
        const anchor = getAnchorPosition();
        if (!targetPoint || pointsEqual(anchor, targetPoint)) {
            return false;
        }

        const created = drawLineBetweenPoints({
            state,
            entryManager,
            faceController,
            graphManager,
            blockManager,
            undoManager,
            onUpdate,
            startPoint: anchor,
            endPoint: targetPoint,
            pathBeforeOverride: [anchor.clone()]
        });

        if (created) {
            selectPointByKey(getVertexKey(targetPoint));
        }

        return created;
    }

    function handlePointerMove(event) {
        if (state.workMode !== 'blueprint') return;
        const layout = getLayout();
        const viewKey = getViewKeyFromEvent(event, layout);

        clearHoveredPoint();
        updatePreviewLine(event, viewKey, layout);
        renderer.domElement.style.cursor = viewKey ? (event.shiftKey ? 'copy' : 'crosshair') : 'default';
    }

    function handleClick(event) {
        if (state.workMode !== 'blueprint') return;

        const layout = getLayout();
        const viewKey = getViewKeyFromEvent(event, layout);
        if (!viewKey) return;

        event.preventDefault();
        event.stopPropagation();

        const nearest = findNearestPoint(viewKey, event, layout);
        const target = nearest?.point ?? getSnappedPointForView(viewKey, event, layout);
        const shouldConnect = Boolean(target) && (
            event.shiftKey ||
            (hasSelectedAnchor() && !pointsEqual(getAnchorPosition(), target))
        );

        if (shouldConnect) {
            if (target && connectAnchorTo(target)) {
                clearHoveredPoint();
                clearPreviewHelpers();
                onUpdate();
                return;
            }
            if (nearest) {
                selectPointByKey(nearest.key);
                clearHoveredPoint();
                clearPreviewHelpers();
                onUpdate();
            }
            return;
        }

        if (nearest) {
            selectPointByKey(nearest.key);
            clearHoveredPoint();
            clearPreviewHelpers();
            onUpdate();
            return;
        }

        if (!target) return;
        moveCursorTo(target);
        clearHoveredPoint();
        clearPreviewHelpers();
        onUpdate();
    }

    function handleMouseLeave() {
        if (state.workMode !== 'blueprint') return;
        clearHoveredPoint();
        clearPreviewHelpers();
        renderer.domElement.style.cursor = 'default';
    }

    renderer.domElement.addEventListener('mousemove', handlePointerMove);
    renderer.domElement.addEventListener('click', handleClick);
    renderer.domElement.addEventListener('mouseleave', handleMouseLeave);

    return {
        setMode(mode) {
            const enabled = mode === 'blueprint';
            state.workMode = enabled ? 'blueprint' : 'classic';
            if (root) {
                root.style.display = enabled ? 'block' : 'none';
            }
            renderer.domElement.style.cursor = enabled ? 'crosshair' : 'default';
            controls.enabled = !enabled;
            clearHoveredPoint();
            clearPreviewHelpers();
            if (!enabled) {
                clearPointSelection();
            }
        },
        render() {
            if (state.workMode !== 'blueprint') return false;

            const layout = getLayout();
            applyLayout(layout);
            updateCameras(layout);

            const size = renderer.getSize(new THREE.Vector2());
            renderer.setScissorTest(false);
            renderer.setViewport(0, 0, size.x, size.y);
            renderer.clear(true, true, true);
            renderer.setScissorTest(true);

            for (const key of ['top', 'right', 'left', 'bottom']) {
                const viewport = layout.gl[key];
                renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
                renderer.setScissor(viewport.x, viewport.y, viewport.width, viewport.height);
                renderer.render(scene, viewMeta[key].camera);
            }

            const previewViewport = layout.gl.preview;
            renderer.setViewport(previewViewport.x, previewViewport.y, previewViewport.width, previewViewport.height);
            renderer.setScissor(previewViewport.x, previewViewport.y, previewViewport.width, previewViewport.height);
            renderer.render(scene, previewCamera);
            renderer.setScissorTest(false);
            return true;
        },
        dispose() {
            renderer.domElement.removeEventListener('mousemove', handlePointerMove);
            renderer.domElement.removeEventListener('click', handleClick);
            renderer.domElement.removeEventListener('mouseleave', handleMouseLeave);
            clearHoveredPoint();
            clearPreviewHelpers();
            scene.remove(previewLine);
            scene.remove(previewPoint);
        }
    };
}
