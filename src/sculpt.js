import * as THREE from 'three';
import { FACE_EPSILON } from './constants.js';

const BRUSH_SEGMENTS = 64;
const ENTRY_RADIUS_PADDING = 1.2;
const BRUSH_STAMP_SPACING = 0.18;
const AGGRESSIVE_STRENGTH_MULTIPLIER = 2.5;

function getBrushBasis(normal) {
    const tangent = new THREE.Vector3();
    if (Math.abs(normal.y) < 0.999) {
        tangent.set(0, 1, 0).cross(normal).normalize();
    } else {
        tangent.set(1, 0, 0).cross(normal).normalize();
    }
    const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    return { tangent, bitangent };
}

function buildBrushPoints(center, normal, radius) {
    const points = [];
    const { tangent, bitangent } = getBrushBasis(normal);
    const offset = normal.clone().multiplyScalar(Math.max(radius * 0.01, FACE_EPSILON * 20));

    for (let index = 0; index <= BRUSH_SEGMENTS; index += 1) {
        const angle = (index / BRUSH_SEGMENTS) * Math.PI * 2;
        const point = center.clone().add(offset);
        point.addScaledVector(tangent, Math.cos(angle) * radius);
        point.addScaledVector(bitangent, Math.sin(angle) * radius);
        points.push(point);
    }

    return points;
}

function getHitData(hit, blockManager) {
    const entry = blockManager.getBlockByMesh(hit.object);
    if (!entry || !entry.active || !hit.face) return null;

    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
    return {
        entry,
        hitPoint: hit.point.clone(),
        normal
    };
}

function ensureUniqueGeometry(entry) {
    if (entry.geometryDetached) return;
    entry.mesh.geometry = entry.mesh.geometry.clone();
    entry.geometryDetached = true;
}

function snapshotPositions(entry) {
    return Float32Array.from(entry.mesh.geometry.attributes.position.array);
}

function getEntryWorldRadius(entry) {
    const geometry = entry.mesh.geometry;
    if (!geometry.boundingSphere) {
        geometry.computeBoundingSphere();
    }
    return (geometry.boundingSphere?.radius ?? 1) * (entry.size ?? 1);
}

function sculptEntry(entry, context, strength, activeStroke, brushRadius) {
    ensureUniqueGeometry(entry);

    const geometry = entry.mesh.geometry;
    const positionAttr = geometry.attributes.position;
    const normalAttr = geometry.attributes.normal;
    if (!positionAttr || !normalAttr) return false;

    if (!activeStroke.snapshots.has(entry)) {
        activeStroke.snapshots.set(entry, { before: snapshotPositions(entry) });
    }

    const worldQuaternion = new THREE.Quaternion();
    const inverseWorldQuaternion = new THREE.Quaternion();
    const worldScale = new THREE.Vector3();
    const worldPosition = new THREE.Vector3();
    entry.mesh.getWorldQuaternion(worldQuaternion);
    inverseWorldQuaternion.copy(worldQuaternion).invert();
    entry.mesh.getWorldScale(worldScale);
    entry.mesh.getWorldPosition(worldPosition);

    const radiusSq = brushRadius * brushRadius;
    const localDisplacementDir = context.normal.clone().applyQuaternion(inverseWorldQuaternion);
    localDisplacementDir.x /= worldScale.x || 1;
    localDisplacementDir.y /= worldScale.y || 1;
    localDisplacementDir.z /= worldScale.z || 1;
    localDisplacementDir.normalize();

    const vertex = new THREE.Vector3();
    let modified = false;

    for (let index = 0; index < positionAttr.count; index += 1) {
        vertex.fromBufferAttribute(positionAttr, index)
            .multiply(worldScale)
            .applyQuaternion(worldQuaternion)
            .add(worldPosition);

        const distanceSq = vertex.distanceToSquared(context.hitPoint);
        if (distanceSq > radiusSq) continue;

        const surfaceOffset = vertex.clone().sub(context.hitPoint).dot(context.normal);
        if (surfaceOffset < -brushRadius * 0.2 || surfaceOffset > brushRadius * 0.35) continue;

        const distance = Math.sqrt(distanceSq);
        const falloff = 1 - distance / brushRadius;
        const displacement = strength * falloff * falloff;
        if (Math.abs(displacement) <= FACE_EPSILON) continue;

        positionAttr.setXYZ(
            index,
            positionAttr.getX(index) + localDisplacementDir.x * displacement,
            positionAttr.getY(index) + localDisplacementDir.y * displacement,
            positionAttr.getZ(index) + localDisplacementDir.z * displacement
        );
        modified = true;
    }

    if (!modified) return false;

    positionAttr.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return true;
}

export function attachSculptControls({ camera, renderer, controls, state, blockManager, undoManager, onUpdate, scene }) {
    if (!blockManager) return { dispose: () => {}, refreshMode: () => {} };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const brushMaterial = new THREE.LineBasicMaterial({
        color: 0x44f0ff,
        transparent: true,
        opacity: 0.95,
        depthTest: false
    });
    const brushCircle = new THREE.Line(new THREE.BufferGeometry(), brushMaterial);
    brushCircle.renderOrder = 5;
    brushCircle.visible = false;
    scene.add(brushCircle);

    let activeStroke = null;
    const previousMouseButtons = {
        LEFT: controls.mouseButtons.LEFT,
        MIDDLE: controls.mouseButtons.MIDDLE,
        RIGHT: controls.mouseButtons.RIGHT
    };

    function updateMouse(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function getHit() {
        const entries = blockManager.getBlockEntries().filter((entry) => entry.active);
        if (entries.length === 0) return null;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(entries.map((entry) => entry.mesh), false);
        return hits.length > 0 ? hits[0] : null;
    }

    function getBrushContext() {
        const hit = getHit();
        if (!hit) return null;
        return getHitData(hit, blockManager);
    }

    function updateBrushPreview(context) {
        if (state.controlMode !== 'sculpt' || !context) {
            brushCircle.visible = false;
            return;
        }

        brushCircle.geometry.setFromPoints(buildBrushPoints(context.hitPoint, context.normal, state.sculptRadius));
        brushCircle.visible = true;
    }

    function getAffectedEntries(context) {
        const limit = state.sculptRadius * ENTRY_RADIUS_PADDING;
        return blockManager.getBlockEntries().filter((entry) => {
            if (!entry.active) return false;
            return entry.position.distanceTo(context.hitPoint) <= limit + getEntryWorldRadius(entry);
        });
    }

    function applyBrush(context, aggressive = false) {
        if (!context || !activeStroke) return;

        if (activeStroke.lastPoint && activeStroke.lastPoint.distanceToSquared(context.hitPoint) < BRUSH_STAMP_SPACING * BRUSH_STAMP_SPACING) {
            return;
        }
        activeStroke.lastPoint = context.hitPoint.clone();

        const baseStrength = Math.max(0.008, state.sculptRadius * 0.018);
        const strength = (state.sculptMode === 'raise' ? 1 : -1)
            * baseStrength
            * (aggressive ? AGGRESSIVE_STRENGTH_MULTIPLIER : 1);
        let modifiedCount = 0;

        for (const entry of getAffectedEntries(context)) {
            if (sculptEntry(entry, context, strength, activeStroke, state.sculptRadius)) {
                modifiedCount += 1;
            }
        }

        if (modifiedCount > 0) {
            onUpdate();
        }
    }

    function finishStroke() {
        if (!activeStroke) return;

        const sculptures = [];
        for (const [entry, snapshot] of activeStroke.snapshots.entries()) {
            const after = snapshotPositions(entry);
            let changed = false;
            for (let index = 0; index < after.length; index += 1) {
                if (Math.abs(after[index] - snapshot.before[index]) > FACE_EPSILON) {
                    changed = true;
                    break;
                }
            }
            if (changed) {
                sculptures.push({ entry, before: snapshot.before, after });
            }
        }

        if (sculptures.length > 0) {
            undoManager.pushAction({
                kind: 'block-sculpt',
                sculptures
            });
        }

        activeStroke = null;
    }

    function onMouseDown(event) {
        if (state.workMode !== 'classic') return;
        if (state.controlMode !== 'sculpt' || event.button !== 0) return;
        updateMouse(event);
        const context = getBrushContext();
        if (!context) return;

        event.preventDefault();
        activeStroke = { snapshots: new Map(), lastPoint: null };
        applyBrush(context, event.shiftKey);
        updateBrushPreview(context);
    }

    function onMouseMove(event) {
        if (state.workMode !== 'classic') {
            brushCircle.visible = false;
            return;
        }
        updateMouse(event);
        const context = getBrushContext();
        updateBrushPreview(context);

        if (state.controlMode !== 'sculpt' || !activeStroke || (event.buttons & 1) === 0) return;

        event.preventDefault();
        applyBrush(context, event.shiftKey);
    }

    function onMouseUp() {
        finishStroke();
    }

    function onMouseLeave() {
        if (!activeStroke) {
            brushCircle.visible = false;
        }
    }

    function onContextMenu(event) {
        if (state.workMode !== 'classic') return;
        if (state.controlMode === 'sculpt') {
            event.preventDefault();
        }
    }

    function refreshMode() {
        const sculptActive = state.controlMode === 'sculpt';
        controls.mouseButtons.LEFT = sculptActive ? null : previousMouseButtons.LEFT;
        controls.mouseButtons.MIDDLE = previousMouseButtons.MIDDLE;
        controls.mouseButtons.RIGHT = previousMouseButtons.RIGHT;
        if (!sculptActive) {
            finishStroke();
            brushCircle.visible = false;
        }
    }

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseleave', onMouseLeave);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('mouseup', onMouseUp);

    refreshMode();

    return {
        refreshMode,
        dispose: () => {
            finishStroke();
            brushCircle.geometry.dispose();
            brushMaterial.dispose();
            scene.remove(brushCircle);
            controls.mouseButtons.LEFT = previousMouseButtons.LEFT;
            controls.mouseButtons.MIDDLE = previousMouseButtons.MIDDLE;
            controls.mouseButtons.RIGHT = previousMouseButtons.RIGHT;
            renderer.domElement.removeEventListener('mousedown', onMouseDown);
            renderer.domElement.removeEventListener('mousemove', onMouseMove);
            renderer.domElement.removeEventListener('mouseleave', onMouseLeave);
            renderer.domElement.removeEventListener('contextmenu', onContextMenu);
            window.removeEventListener('mouseup', onMouseUp);
        }
    };
}
