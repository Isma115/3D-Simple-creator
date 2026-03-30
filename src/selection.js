import * as THREE from 'three';
import { getBestAxis, getVertexKey, getEdgePlaneCandidates, getPlaneKey, pointsEqual } from './geometry.js';
import { FACE_EPSILON, STEP_SIZE } from './constants.js';
import { drawLineBetweenPoints } from './input.js';

const FACE_HOVER_EMISSIVE = 0x7ee8a0;
const FACE_SELECTED_EMISSIVE = 0x1fb655;

function getSelectedFaces(state) {
    if (!state.selectedFace) return [];
    return Array.isArray(state.selectedFace) ? state.selectedFace : [state.selectedFace];
}

function mergeUniqueFaces(...faceGroups) {
    const merged = [];
    const seen = new Set();

    for (const group of faceGroups) {
        for (const face of group ?? []) {
            const identity = getFaceIdentity(face);
            if (!identity || seen.has(identity)) continue;
            seen.add(identity);
            merged.push(face);
        }
    }

    return merged;
}

function getBlockMaterialIndex(face) {
    if (typeof face?.faceIndex !== 'number') return 0;
    return Math.floor(face.faceIndex / 2);
}

function isImportedBlockFace(face) {
    return face?.data?.entry?.geometryType?.startsWith?.('imported-') ?? false;
}

function shouldTreatFaceAsWholeMesh(face) {
    return Boolean(face?.applyToWholeMesh || isImportedBlockFace(face));
}

function getFaceMaterial(face) {
    if (!face?.mesh?.material) return null;
    if (Array.isArray(face.mesh.material)) {
        if (shouldTreatFaceAsWholeMesh(face)) {
            return face.mesh.material[0] ?? null;
        }
        return face.mesh.material[getBlockMaterialIndex(face)] ?? null;
    }
    return face.mesh.material;
}

function setFaceEmissive(face, color) {
    const material = getFaceMaterial(face);
    if (material?.emissive) {
        material.emissive.setHex(color);
    }
}

function clearMeshEmissive(mesh) {
    if (!mesh?.material) return;
    if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => {
            if (material?.emissive) {
                material.emissive.setHex(0x000000);
            }
        });
        return;
    }
    if (mesh.material.emissive) {
        mesh.material.emissive.setHex(0x000000);
    }
}

function getFaceIdentity(face) {
    if (!face?.mesh) return '';
    if (face.data?.type === 'block' && !shouldTreatFaceAsWholeMesh(face)) {
        return `block:${face.mesh.uuid}:${getBlockMaterialIndex(face)}`;
    }
    if (face.data?.type === 'merged-block' && typeof face.faceIndex === 'number') {
        return `merged-block:${face.mesh.uuid}:${Math.floor(face.faceIndex / 2)}`;
    }
    return `mesh:${face.mesh.uuid}`;
}

function getFaceTriangles(face) {
    if (!face?.mesh) return [];
    if (face.data?.type === 'block' && !shouldTreatFaceAsWholeMesh(face)) {
        return getBlockFaceTriangles(face.mesh, face.faceIndex);
    }
    if (face.data?.type === 'merged-block' && typeof face.faceIndex === 'number') {
        return getMergedBlockFaceTriangles(face.mesh, face.faceIndex);
    }
    return getAllTriangles(face.mesh);
}

function createFaceOverlayMesh(face, color, opacity) {
    const geometry = face?.mesh?.geometry;
    const positionAttribute = geometry?.getAttribute?.('position');
    if (!geometry || !positionAttribute) return null;

    const positions = [];
    for (const triangle of getFaceTriangles(face)) {
        for (const index of triangle) {
            const vertex = new THREE.Vector3()
                .fromBufferAttribute(positionAttribute, index)
                .applyMatrix4(face.mesh.matrixWorld);
            positions.push(vertex.x, vertex.y, vertex.z);
        }
    }

    if (positions.length === 0) return null;

    const overlayGeometry = new THREE.BufferGeometry();
    overlayGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    overlayGeometry.computeVertexNormals();

    const overlayMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
    });

    const overlayMesh = new THREE.Mesh(overlayGeometry, overlayMaterial);
    overlayMesh.renderOrder = 12;
    return overlayMesh;
}

function cloneTextureForFace(texture) {
    const clonedTexture = texture.clone();
    clonedTexture.wrapS = THREE.RepeatWrapping;
    clonedTexture.wrapT = THREE.RepeatWrapping;
    clonedTexture.colorSpace = texture.colorSpace ?? THREE.SRGBColorSpace;
    clonedTexture.needsUpdate = true;
    return clonedTexture;
}

function ensureUniqueGeometry(mesh) {
    if (mesh.userData.uniqueUvGeometry) return;
    mesh.geometry = mesh.geometry.clone();
    mesh.userData.uniqueUvGeometry = true;
}

function ensureEditableBlockMaterials(mesh) {
    if (!Array.isArray(mesh.material)) {
        const baseMaterial = mesh.material;
        const materialCount = Math.max(
            mesh.geometry?.groups?.reduce((max, group) => Math.max(max, group.materialIndex), -1) + 1,
            1
        );
        mesh.material = Array.from({ length: materialCount }, () => baseMaterial.clone());
        mesh.userData.blockFaceMaterialsUnique = true;
        return;
    }

    if (!mesh.userData.blockFaceMaterialsUnique) {
        mesh.material = mesh.material.map((material) => material.clone());
        mesh.userData.blockFaceMaterialsUnique = true;
    }
}

function ensureUvAttribute(geometry) {
    let uvAttribute = geometry.getAttribute('uv');
    if (uvAttribute) return uvAttribute;

    const positionAttribute = geometry.getAttribute('position');
    uvAttribute = new THREE.Float32BufferAttribute(positionAttribute.count * 2, 2);
    geometry.setAttribute('uv', uvAttribute);
    return uvAttribute;
}

function getAllTriangles(mesh) {
    const geometry = mesh.geometry;
    const index = geometry.index;
    const triangles = [];

    if (index) {
        for (let i = 0; i < index.count; i += 3) {
            triangles.push([
                index.getX(i),
                index.getX(i + 1),
                index.getX(i + 2)
            ]);
        }
        return triangles;
    }

    const positionCount = geometry.getAttribute('position').count;
    for (let i = 0; i < positionCount; i += 3) {
        triangles.push([i, i + 1, i + 2]);
    }
    return triangles;
}

function getBlockFaceTriangles(mesh, faceIndex) {
    const index = mesh.geometry.index;
    if (!index) {
        return getAllTriangles(mesh).slice(0, 2);
    }

    const start = getBlockMaterialIndex({ faceIndex }) * 6;
    if (start + 5 >= index.count) {
        return getAllTriangles(mesh).slice(0, 2);
    }

    return [
        [index.getX(start), index.getX(start + 1), index.getX(start + 2)],
        [index.getX(start + 3), index.getX(start + 4), index.getX(start + 5)]
    ];
}

function getMergedBlockFaceTriangles(mesh, faceIndex) {
    const index = mesh.geometry.index;
    if (!index) {
        return getAllTriangles(mesh).slice(Math.floor(faceIndex / 2) * 2, Math.floor(faceIndex / 2) * 2 + 2);
    }

    const start = Math.floor(faceIndex / 2) * 6;
    if (start + 5 >= index.count) {
        return getAllTriangles(mesh).slice(Math.floor(faceIndex / 2) * 2, Math.floor(faceIndex / 2) * 2 + 2);
    }

    return [
        [index.getX(start), index.getX(start + 1), index.getX(start + 2)],
        [index.getX(start + 3), index.getX(start + 4), index.getX(start + 5)]
    ];
}

function collectUvTargets(selectedFaces) {
    return selectedFaces.map((face) => {
        const mesh = face.mesh;
        const treatAsWholeMesh = shouldTreatFaceAsWholeMesh(face);
        if (face.data?.type === 'block') {
            ensureUniqueGeometry(mesh);
            if (!treatAsWholeMesh) {
                ensureEditableBlockMaterials(mesh);
            }
        }

        const geometry = mesh.geometry;
        const uvAttribute = ensureUvAttribute(geometry);
        const triangles = face.data?.type === 'block' && !treatAsWholeMesh
            ? getBlockFaceTriangles(mesh, face.faceIndex)
            : getAllTriangles(mesh);
        const refs = new Map();

        for (const triangle of triangles) {
            for (const uvIndex of triangle) {
                if (refs.has(uvIndex)) continue;
                const worldPosition = new THREE.Vector3()
                    .fromBufferAttribute(geometry.getAttribute('position'), uvIndex)
                    .applyMatrix4(mesh.matrixWorld);
                refs.set(uvIndex, {
                    id: `${mesh.uuid}:${uvIndex}`,
                    uvIndex,
                    worldPosition
                });
            }
        }

        return {
            face,
            mesh,
            geometry,
            uvAttribute,
            triangles,
            refs: Array.from(refs.values())
        };
    });
}

function buildUvEditorPayload(targets) {
    const points = [];
    const triangles = [];
    const seen = new Set();

    for (const target of targets) {
        for (const ref of target.refs) {
            if (seen.has(ref.id)) continue;
            points.push({
                id: ref.id,
                x: target.uvAttribute.getX(ref.uvIndex),
                y: target.uvAttribute.getY(ref.uvIndex)
            });
            seen.add(ref.id);
        }

        for (const triangle of target.triangles) {
            triangles.push(triangle.map((uvIndex) => `${target.mesh.uuid}:${uvIndex}`));
        }
    }

    return { points, triangles };
}

function buildUvSessionSignature(targets) {
    const refIds = [];

    for (const target of targets) {
        for (const ref of target.refs) {
            refIds.push(ref.id);
        }
    }

    refIds.sort();
    return refIds.join('|');
}

function findProjectionBasis(targets) {
    for (const target of targets) {
        for (const triangle of target.triangles) {
            const [aIndex, bIndex, cIndex] = triangle;
            const a = new THREE.Vector3()
                .fromBufferAttribute(target.geometry.getAttribute('position'), aIndex)
                .applyMatrix4(target.mesh.matrixWorld);
            const b = new THREE.Vector3()
                .fromBufferAttribute(target.geometry.getAttribute('position'), bIndex)
                .applyMatrix4(target.mesh.matrixWorld);
            const c = new THREE.Vector3()
                .fromBufferAttribute(target.geometry.getAttribute('position'), cIndex)
                .applyMatrix4(target.mesh.matrixWorld);
            const edgeA = b.clone().sub(a);
            const edgeB = c.clone().sub(a);
            const normal = new THREE.Vector3().crossVectors(edgeA, edgeB);

            if (normal.lengthSq() < 1e-8 || edgeA.lengthSq() < 1e-8) {
                continue;
            }

            const tangent = edgeA.normalize();
            const bitangent = new THREE.Vector3().crossVectors(normal.normalize(), tangent).normalize();
            if (bitangent.lengthSq() < 1e-8) {
                continue;
            }

            return { tangent, bitangent };
        }
    }

    return {
        tangent: new THREE.Vector3(1, 0, 0),
        bitangent: new THREE.Vector3(0, 1, 0)
    };
}

function buildFittedUvMap(targets) {
    const uniqueRefs = new Map();
    for (const target of targets) {
        for (const ref of target.refs) {
            uniqueRefs.set(ref.id, ref);
        }
    }

    const { tangent, bitangent } = findProjectionBasis(targets);
    let minU = Infinity;
    let minV = Infinity;
    let maxU = -Infinity;
    let maxV = -Infinity;
    const projected = [];

    for (const ref of uniqueRefs.values()) {
        const u = ref.worldPosition.dot(tangent);
        const v = ref.worldPosition.dot(bitangent);
        projected.push({ id: ref.id, u, v });
        minU = Math.min(minU, u);
        minV = Math.min(minV, v);
        maxU = Math.max(maxU, u);
        maxV = Math.max(maxV, v);
    }

    const width = Math.max(maxU - minU, 1e-6);
    const height = Math.max(maxV - minV, 1e-6);
    const pointMap = new Map();

    for (const point of projected) {
        pointMap.set(point.id, new THREE.Vector2(
            (point.u - minU) / width,
            (point.v - minV) / height
        ));
    }

    return pointMap;
}

function applyUvPointMap(targets, pointMap) {
    for (const target of targets) {
        for (const ref of target.refs) {
            const uv = pointMap.get(ref.id);
            if (!uv) continue;
            target.uvAttribute.setXY(ref.uvIndex, uv.x, uv.y);
        }
        target.uvAttribute.needsUpdate = true;
    }

    return buildUvEditorPayload(targets);
}

function buildCurrentUvMap(targets) {
    const pointMap = new Map();

    for (const target of targets) {
        for (const ref of target.refs) {
            if (pointMap.has(ref.id)) continue;
            pointMap.set(ref.id, new THREE.Vector2(
                target.uvAttribute.getX(ref.uvIndex),
                target.uvAttribute.getY(ref.uvIndex)
            ));
        }
    }

    return pointMap;
}

function assignTextureToFaces(selectedFaces, texture, { preserveUvLayout = false } = {}) {
    if (selectedFaces.length === 0) return false;

    if (!texture) {
        selectedFaces.forEach((face) => {
            if (face.data?.type === 'block') {
                ensureEditableBlockMaterials(face.mesh);
                if (face.applyToWholeMesh) {
                    face.mesh.material = face.mesh.material.map((material) => {
                        const nextMaterial = material.clone();
                        nextMaterial.map = null;
                        nextMaterial.needsUpdate = true;
                        return nextMaterial;
                    });
                    return;
                }

                const materialIndex = getBlockMaterialIndex(face);
                const currentMaterial = face.mesh.material[materialIndex];
                const nextMaterial = currentMaterial.clone();
                nextMaterial.map = null;
                nextMaterial.needsUpdate = true;
                face.mesh.material[materialIndex] = nextMaterial;
                return;
            }

            const nextMaterial = face.mesh.material.clone();
            nextMaterial.map = null;
            nextMaterial.needsUpdate = true;
            face.mesh.material = nextMaterial;
        });
        return true;
    }

    const targets = collectUvTargets(selectedFaces);
    const pointMap = preserveUvLayout
        ? buildCurrentUvMap(targets)
        : buildFittedUvMap(targets);

    selectedFaces.forEach((face) => {
        if (face.data?.type === 'block') {
            ensureEditableBlockMaterials(face.mesh);
            if (face.applyToWholeMesh) {
                face.mesh.material = face.mesh.material.map((material) => {
                    const nextMaterial = material.clone();
                    nextMaterial.map = cloneTextureForFace(texture);
                    nextMaterial.needsUpdate = true;
                    return nextMaterial;
                });
                return;
            }

            const materialIndex = getBlockMaterialIndex(face);
            const currentMaterial = face.mesh.material[materialIndex];
            const nextMaterial = currentMaterial.clone();
            nextMaterial.map = cloneTextureForFace(texture);
            nextMaterial.needsUpdate = true;
            face.mesh.material[materialIndex] = nextMaterial;
            return;
        }

        const nextMaterial = face.mesh.material.clone();
        nextMaterial.map = cloneTextureForFace(texture);
        nextMaterial.needsUpdate = true;
        face.mesh.material = nextMaterial;
    });

    applyUvPointMap(targets, pointMap);
    return true;
}

function getSelectionTexture(selectedFaces) {
    for (const face of selectedFaces) {
        const texture = getFaceMaterial(face)?.map;
        if (texture) return texture;
    }
    return null;
}

function createUvEditorSession(selectedFaces, fallbackTexture) {
    if (selectedFaces.length === 0) return null;

    const selectionHasTexture = selectedFaces.every((face) => Boolean(getFaceMaterial(face)?.map));
    const sourceTexture = getSelectionTexture(selectedFaces) ?? fallbackTexture;
    if (!selectionHasTexture) {
        if (!sourceTexture) return null;
        assignTextureToFaces(selectedFaces, sourceTexture, { preserveUvLayout: false });
    }

    const targets = collectUvTargets(selectedFaces);
    const resetMap = buildFittedUvMap(targets);
    const payload = buildUvEditorPayload(targets);

    return {
        signature: buildUvSessionSignature(targets),
        texture: getSelectionTexture(selectedFaces),
        points: payload.points,
        triangles: payload.triangles,
        update(nextPoints) {
            const pointMap = new Map(
                nextPoints.map((point) => [point.id, new THREE.Vector2(point.x, point.y)])
            );
            const nextPayload = applyUvPointMap(targets, pointMap);
            this.points = nextPayload.points;
            this.triangles = nextPayload.triangles;
        },
        reset() {
            const nextPayload = applyUvPointMap(targets, resetMap);
            this.points = nextPayload.points;
            this.triangles = nextPayload.triangles;
            return nextPayload;
        }
    };
}

export function attachSelection({ camera, renderer, entryManager, blockManager, state, onUpdate, scene, graphManager, faceController, undoManager }) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const mouseScreen = new THREE.Vector2();
    const projectedPoint = new THREE.Vector3();
    const POINT_HOVER_RADIUS_PX = 18;
    let hoveredEntry = null;
    let hoveredBlock = null;
    const gridHoverMesh = new THREE.Mesh(state.pointGeometry, state.pointMaterial.clone());
    gridHoverMesh.renderOrder = 2;
    gridHoverMesh.visible = false;
    scene.add(gridHoverMesh);
    const previewLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        state.lineMaterial.clone()
    );
    previewLine.material.transparent = true;
    previewLine.material.opacity = 0.7;
    previewLine.renderOrder = 10;
    previewLine.visible = false;
    scene.add(previewLine);
    const previewStartMesh = new THREE.Mesh(state.pointGeometry, state.pointMaterial.clone());
    previewStartMesh.renderOrder = 2;
    previewStartMesh.visible = false;
    previewStartMesh.scale.setScalar(1.35);
    scene.add(previewStartMesh);
    const previewEndMesh = new THREE.Mesh(state.pointGeometry, state.pointMaterial.clone());
    previewEndMesh.renderOrder = 2;
    previewEndMesh.visible = false;
    previewEndMesh.scale.setScalar(1.35);
    scene.add(previewEndMesh);
    const joinMenu = document.createElement('div');
    joinMenu.className = 'context-menu';
    joinMenu.style.display = 'none';
    const joinAction = document.createElement('button');
    joinAction.type = 'button';
    joinAction.textContent = 'Unir';
    joinMenu.appendChild(joinAction);
    document.body.appendChild(joinMenu);
    const DRAG_SCALE = STEP_SIZE / 50;
    let dragState = null;
    let clickDragState = null;
    let suppressClick = false;
    let hoveredFacePreviewMeshes = [];
    let selectedFacePreviewMeshes = [];

    function updateMouse(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseScreen.set(event.clientX - rect.left, event.clientY - rect.top);
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickEntry(includeHidden = false) {
        const entries = entryManager.getPointEntries().filter((entry) => entry.active && (includeHidden || entry.faceEligible));
        if (entries.length === 0) return null;
        const meshes = entries.map((entry) => entry.mesh);
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length > 0) {
            const entry = entryManager.getEntryByMesh(hits[0].object);
            if (entry) return entry;
        }

        const rect = renderer.domElement.getBoundingClientRect();
        let closestEntry = null;
        let closestDistanceSq = POINT_HOVER_RADIUS_PX * POINT_HOVER_RADIUS_PX;

        for (const entry of entries) {
            projectedPoint.copy(entry.position).project(camera);
            if (projectedPoint.z < -1 || projectedPoint.z > 1) continue;
            const screenX = ((projectedPoint.x + 1) * 0.5) * rect.width;
            const screenY = ((1 - projectedPoint.y) * 0.5) * rect.height;
            const dx = screenX - mouseScreen.x;
            const dy = screenY - mouseScreen.y;
            const distanceSq = dx * dx + dy * dy;
            if (distanceSq > closestDistanceSq) continue;
            closestDistanceSq = distanceSq;
            closestEntry = entry;
        }

        return closestEntry;
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

    function hideLinePreview() {
        previewLine.visible = false;
        previewStartMesh.visible = false;
        previewEndMesh.visible = false;
    }

    function showJoinMenu(x, y) {
        joinMenu.style.left = `${x}px`;
        joinMenu.style.top = `${y}px`;
        joinMenu.style.display = 'block';
    }

    function hideJoinMenu() {
        joinMenu.style.display = 'none';
    }

    function clearFacePreviewMeshes(meshes) {
        meshes.forEach((mesh) => {
            scene.remove(mesh);
            mesh.geometry?.dispose?.();
            mesh.material?.dispose?.();
        });
        meshes.length = 0;
    }

    function setFacePreviewMeshes(targetMeshes, faces, color, opacity) {
        clearFacePreviewMeshes(targetMeshes);
        for (const face of faces) {
            const overlayMesh = createFaceOverlayMesh(face, color, opacity);
            if (!overlayMesh) continue;
            targetMeshes.push(overlayMesh);
            scene.add(overlayMesh);
        }
    }

    function getEntryKey(entry) {
        if (!entry) return null;
        return entry.vertexKey ?? getVertexKey(entry.position);
    }

    function getPointPositionByKey(key) {
        if (!key) return null;
        const statePosition = state.vertexPositions.get(key);
        if (statePosition) return statePosition;
        const entries = entryManager.getPointEntriesByKey(key);
        for (const entry of entries) {
            if (entry.active) return entry.position;
        }
        return null;
    }

    function getPreviewOrigin() {
        if (state.controlMode !== 'lines') return null;
        const lastSelectedKey = state.selectedPointKeys[state.selectedPointKeys.length - 1];
        if (lastSelectedKey) {
            return getPointPositionByKey(lastSelectedKey);
        }
        if (state.selectedEntry?.position) {
            return state.selectedEntry.position;
        }
        return state.currentPosition;
    }

    function handleLinePreview(targetPosition) {
        const origin = getPreviewOrigin();
        if (!origin || !targetPosition || pointsEqual(origin, targetPosition)) {
            hideLinePreview();
            return;
        }
        previewLine.geometry.setFromPoints([origin, targetPosition]);
        previewLine.geometry.computeBoundingSphere();
        previewStartMesh.position.copy(origin);
        previewEndMesh.position.copy(targetPosition);
        previewLine.visible = true;
        previewStartMesh.visible = true;
        previewEndMesh.visible = true;
    }

    function pickFace() {
        // Collect all face meshes
        const planeMeshes = [];
        const planeByMesh = new Map();
        
        // 1. Plane faces
        for (const planeData of state.planeFill.values()) {
            if (!planeData || !planeData.mesh) continue;
            planeMeshes.push(planeData.mesh);
            planeByMesh.set(planeData.mesh, { type: 'plane', data: planeData });
        }
        
        // 2. Loose faces
        for (const [key, mesh] of state.looseFaceMeshes.entries()) {
            if (!mesh) continue;
            planeMeshes.push(mesh);
            planeByMesh.set(mesh, { type: 'loose', key });
        }
        
        // 3. Block faces (each block is a mesh)
        if (blockManager) {
            for (const entry of blockManager.getBlockEntries()) {
                if (entry.active && entry.mesh) {
                    planeMeshes.push(entry.mesh);
                    planeByMesh.set(entry.mesh, {
                        type: entry.geometryType === 'merged-cube' ? 'merged-block' : 'block',
                        entry
                    });
                }
            }
        }

        if (planeMeshes.length === 0) return null;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(planeMeshes, false);
        if (hits.length === 0) return null;

        const hit = hits[0];
        const faceData = planeByMesh.get(hit.object);
        
        return {
            mesh: hit.object,
            faceIndex: hit.faceIndex, // Important for applying materials to specific faces of a geometry
            data: faceData
        };
    }

    function getFaceProjectionAxes(normal) {
        const absX = Math.abs(normal.x);
        const absY = Math.abs(normal.y);
        const absZ = Math.abs(normal.z);

        if (absX >= absY && absX >= absZ) return ['y', 'z'];
        if (absY >= absX && absY >= absZ) return ['x', 'z'];
        return ['x', 'y'];
    }

    function isPointInsideBlock(point, entry) {
        const dimensions = entry?.dimensions?.isVector3
            ? entry.dimensions
            : new THREE.Vector3(entry?.size ?? 1, entry?.size ?? 1, entry?.size ?? 1);
        const half = dimensions.clone().multiplyScalar(0.5);
        const epsilon = 1e-4;
        return (
            point.x >= entry.position.x - half.x - epsilon &&
            point.x <= entry.position.x + half.x + epsilon &&
            point.y >= entry.position.y - half.y - epsilon &&
            point.y <= entry.position.y + half.y + epsilon &&
            point.z >= entry.position.z - half.z - epsilon &&
            point.z <= entry.position.z + half.z + epsilon
        );
    }

    function getProjectedFaceBounds(mesh, faceIndex, worldNormal) {
        const positionAttribute = mesh.geometry?.attributes?.position;
        if (!positionAttribute) return null;

        const [uAxis, vAxis] = getFaceProjectionAxes(worldNormal);
        const seen = new Set();
        let minU = Infinity;
        let maxU = -Infinity;
        let minV = Infinity;
        let maxV = -Infinity;

        for (const triangle of getBlockFaceTriangles(mesh, faceIndex)) {
            for (const vertexIndex of triangle) {
                if (seen.has(vertexIndex)) continue;
                seen.add(vertexIndex);

                const vertex = new THREE.Vector3()
                    .fromBufferAttribute(positionAttribute, vertexIndex)
                    .applyMatrix4(mesh.matrixWorld);
                minU = Math.min(minU, vertex[uAxis]);
                maxU = Math.max(maxU, vertex[uAxis]);
                minV = Math.min(minV, vertex[vAxis]);
                maxV = Math.max(maxV, vertex[vAxis]);
            }
        }

        if (!Number.isFinite(minU) || !Number.isFinite(minV)) return null;

        return { minU, maxU, minV, maxV };
    }

    function getFaceIndexForNormal(mesh, targetNormal, planeD) {
        const geometry = mesh?.geometry;
        if (!geometry?.index || !geometry?.attributes?.position) return -1;

        const localNormal = new THREE.Vector3();
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);

        for (let triangleIndex = 0; triangleIndex < geometry.index.count / 3; triangleIndex += 2) {
            const a = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, geometry.index.getX(triangleIndex * 3));
            const b = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, geometry.index.getX(triangleIndex * 3 + 1));
            const c = new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, geometry.index.getX(triangleIndex * 3 + 2));

            localNormal.crossVectors(c.clone().sub(b), a.clone().sub(b)).normalize();
            const worldNormal = localNormal.clone().applyMatrix3(normalMatrix).normalize();
            if (worldNormal.dot(targetNormal) <= 0.99) continue;

            const worldPoint = a.clone().applyMatrix4(mesh.matrixWorld);
            if (Math.abs(targetNormal.dot(worldPoint) - planeD) > 1e-4) continue;
            return triangleIndex;
        }

        return -1;
    }

    function getCoplanarBlockFaceCandidates(entries, worldNormal, planeD) {
        const candidates = [];

        for (const entry of entries) {
            if (!entry?.mesh) continue;
            const candidateFaceIndex = getFaceIndexForNormal(entry.mesh, worldNormal, planeD);
            if (candidateFaceIndex === -1) continue;

            const face = {
                mesh: entry.mesh,
                data: { type: 'block', entry },
                faceIndex: candidateFaceIndex
            };
            if (!isFaceExposed(face)) continue;

            const bounds = getProjectedFaceBounds(entry.mesh, candidateFaceIndex, worldNormal);
            if (!bounds) continue;

            candidates.push({
                mesh: entry.mesh,
                entry,
                faceIndex: candidateFaceIndex,
                bounds
            });
        }

        return candidates;
    }

    function rangesOverlapWithLength(minA, maxA, minB, maxB, epsilon = 1e-4) {
        return (Math.min(maxA, maxB) - Math.max(minA, minB)) > epsilon;
    }

    function faceBoundsShareEdge(a, b, epsilon = 1e-4) {
        const touchVertical =
            (Math.abs(a.maxU - b.minU) <= epsilon || Math.abs(b.maxU - a.minU) <= epsilon) &&
            rangesOverlapWithLength(a.minV, a.maxV, b.minV, b.maxV, epsilon);
        const touchHorizontal =
            (Math.abs(a.maxV - b.minV) <= epsilon || Math.abs(b.maxV - a.minV) <= epsilon) &&
            rangesOverlapWithLength(a.minU, a.maxU, b.minU, b.maxU, epsilon);
        return touchVertical || touchHorizontal;
    }

    function nearlyEqual(a, b, epsilon = 1e-4) {
        return Math.abs(a - b) <= epsilon;
    }

    function buildUniformFaceGrid(candidates, startBounds, epsilon = 1e-4) {
        const width = startBounds.maxU - startBounds.minU;
        const height = startBounds.maxV - startBounds.minV;
        if (width <= epsilon || height <= epsilon) return null;

        const compatible = candidates.filter((candidate) => {
            const candidateWidth = candidate.bounds.maxU - candidate.bounds.minU;
            const candidateHeight = candidate.bounds.maxV - candidate.bounds.minV;
            return nearlyEqual(candidateWidth, width, epsilon) && nearlyEqual(candidateHeight, height, epsilon);
        });

        const map = new Map();
        for (const candidate of compatible) {
            const col = Math.round((candidate.bounds.minU - startBounds.minU) / width);
            const row = Math.round((candidate.bounds.minV - startBounds.minV) / height);
            map.set(`${col},${row}`, { ...candidate, col, row });
        }

        return { width, height, map };
    }

    function getRectangleCellsFromGrid(grid, startCell) {
        if (!grid || !startCell) return [];

        const { map } = grid;

        function hasCell(col, row) {
            return map.has(`${col},${row}`);
        }

        function getCell(col, row) {
            return map.get(`${col},${row}`) ?? null;
        }

        function expandHorizontal(col, row) {
            let minCol = col;
            let maxCol = col;
            while (hasCell(minCol - 1, row)) minCol -= 1;
            while (hasCell(maxCol + 1, row)) maxCol += 1;
            return { minCol, maxCol };
        }

        function expandVertical(col, row) {
            let minRow = row;
            let maxRow = row;
            while (hasCell(col, minRow - 1)) minRow -= 1;
            while (hasCell(col, maxRow + 1)) maxRow += 1;
            return { minRow, maxRow };
        }

        function canFillRow(row, minCol, maxCol) {
            for (let col = minCol; col <= maxCol; col++) {
                if (!hasCell(col, row)) return false;
            }
            return true;
        }

        function canFillColumn(col, minRow, maxRow) {
            for (let row = minRow; row <= maxRow; row++) {
                if (!hasCell(col, row)) return false;
            }
            return true;
        }

        function buildHorizontalFirstRectangle() {
            const horizontal = expandHorizontal(startCell.col, startCell.row);
            let minRow = startCell.row;
            let maxRow = startCell.row;

            while (canFillRow(minRow - 1, horizontal.minCol, horizontal.maxCol)) minRow -= 1;
            while (canFillRow(maxRow + 1, horizontal.minCol, horizontal.maxCol)) maxRow += 1;

            return {
                minCol: horizontal.minCol,
                maxCol: horizontal.maxCol,
                minRow,
                maxRow
            };
        }

        function buildVerticalFirstRectangle() {
            const vertical = expandVertical(startCell.col, startCell.row);
            let minCol = startCell.col;
            let maxCol = startCell.col;

            while (canFillColumn(minCol - 1, vertical.minRow, vertical.maxRow)) minCol -= 1;
            while (canFillColumn(maxCol + 1, vertical.minRow, vertical.maxRow)) maxCol += 1;

            return {
                minCol,
                maxCol,
                minRow: vertical.minRow,
                maxRow: vertical.maxRow
            };
        }

        function rectangleArea(rectangle) {
            return (rectangle.maxCol - rectangle.minCol + 1) * (rectangle.maxRow - rectangle.minRow + 1);
        }

        const horizontalRectangle = buildHorizontalFirstRectangle();
        const verticalRectangle = buildVerticalFirstRectangle();
        const chosenRectangle = rectangleArea(horizontalRectangle) >= rectangleArea(verticalRectangle)
            ? horizontalRectangle
            : verticalRectangle;

        const cells = [];
        for (let row = chosenRectangle.minRow; row <= chosenRectangle.maxRow; row++) {
            for (let col = chosenRectangle.minCol; col <= chosenRectangle.maxCol; col++) {
                const cell = getCell(col, row);
                if (cell) cells.push(cell);
            }
        }

        return cells;
    }

    function getJointFaceBlocks(startMesh, faceIndex) {
        if (!blockManager) return [ { mesh: startMesh, faceIndex } ];
        
        // Get normal of the clicked face
        const normal = new THREE.Vector3();
        const positions = startMesh.geometry.attributes.position;
        const index = startMesh.geometry.index;
        
        const a = new THREE.Vector3().fromBufferAttribute(positions, index.getX(faceIndex * 3));
        const b = new THREE.Vector3().fromBufferAttribute(positions, index.getX(faceIndex * 3 + 1));
        const c = new THREE.Vector3().fromBufferAttribute(positions, index.getX(faceIndex * 3 + 2));
        
        const cb = new THREE.Vector3().subVectors(c, b);
        const ab = new THREE.Vector3().subVectors(a, b);
        normal.crossVectors(cb, ab).normalize();
        
        // Transform normal to world space
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(startMesh.matrixWorld);
        const worldNormal = normal.clone().applyMatrix3(normalMatrix).normalize();
        
        // Determine the plane equation: n.dot(p) = d
        const planePoint = a.clone().applyMatrix4(startMesh.matrixWorld);
        const planeD = worldNormal.dot(planePoint);
        
        const allBlocks = blockManager.getBlockEntries().filter((entry) => entry.active);
        const jointSelectionType = document.querySelector('input[name="joint-face-selection-type"]:checked')?.value ?? 'type-2';
        const candidates = getCoplanarBlockFaceCandidates(allBlocks, worldNormal, planeD);

        const startCandidate = candidates.find((candidate) => candidate.mesh === startMesh);
        if (!startCandidate) {
            return [{ mesh: startMesh, data: { type: 'block', entry: blockManager.getBlockByMesh(startMesh) }, faceIndex }];
        }

        let selectedCandidates = [startCandidate];

        if (jointSelectionType === 'type-1') {
            const visited = new Set([startCandidate.mesh.uuid]);
            const queue = [startCandidate];
            const connectedCandidates = [];

            while (queue.length > 0) {
                const current = queue.shift();
                connectedCandidates.push(current);

                for (const candidate of candidates) {
                    if (visited.has(candidate.mesh.uuid)) continue;
                    if (!faceBoundsShareEdge(current.bounds, candidate.bounds)) continue;
                    visited.add(candidate.mesh.uuid);
                    queue.push(candidate);
                }
            }

            selectedCandidates = connectedCandidates;
        } else {
            const uniformGrid = buildUniformFaceGrid(candidates, startCandidate.bounds);
            const rectangleCells = getRectangleCellsFromGrid(uniformGrid, uniformGrid?.map.get('0,0') ?? null);
            selectedCandidates = rectangleCells.length > 0 ? rectangleCells : [startCandidate];
        }

        const result = [];
        for (const candidate of selectedCandidates) {
            result.push({
                mesh: candidate.mesh,
                data: { type: 'block', entry: candidate.entry },
                faceIndex: candidate.faceIndex
            });
        }

        return result;
    }

    function isNeighborFaceMode() {
        return state.controlMode === 'select-face-neighbors';
    }

    function getNeighborFaceDepth() {
        const rawValue = document.getElementById('face-neighbor-depth-input')?.value ?? '0';
        const parsed = Number.parseInt(rawValue, 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
            return 0;
        }
        return parsed;
    }

    function getFaceWorldQuad(face) {
        const geometry = face?.mesh?.geometry;
        const positionAttribute = geometry?.getAttribute?.('position');
        if (!geometry || !positionAttribute) return [];

        const points = [];
        const seen = new Set();
        for (const triangle of getFaceTriangles(face)) {
            for (const index of triangle) {
                const vertex = new THREE.Vector3()
                    .fromBufferAttribute(positionAttribute, index)
                    .applyMatrix4(face.mesh.matrixWorld);
                const key = getVertexKey(vertex);
                if (seen.has(key)) continue;
                seen.add(key);
                points.push(vertex);
            }
        }
        return points;
    }

    function isFaceExposed(face) {
        const entry = face?.data?.entry;
        if (!entry?.active || !blockManager) return false;
        const points = getFaceWorldQuad(face);
        if (points.length === 0) return false;

        const center = points.reduce((acc, point) => acc.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
        const normal = new THREE.Vector3();
        const firstTriangle = getFaceTriangles(face)[0];
        if (!firstTriangle) return false;

        const a = new THREE.Vector3()
            .fromBufferAttribute(face.mesh.geometry.getAttribute('position'), firstTriangle[0])
            .applyMatrix4(face.mesh.matrixWorld);
        const b = new THREE.Vector3()
            .fromBufferAttribute(face.mesh.geometry.getAttribute('position'), firstTriangle[1])
            .applyMatrix4(face.mesh.matrixWorld);
        const c = new THREE.Vector3()
            .fromBufferAttribute(face.mesh.geometry.getAttribute('position'), firstTriangle[2])
            .applyMatrix4(face.mesh.matrixWorld);
        normal.crossVectors(c.clone().sub(b), a.clone().sub(b)).normalize();

        const samplePoint = center.clone().add(normal.multiplyScalar(0.01));
        return !blockManager.getBlockEntries().some((candidate) => {
            if (!candidate.active || candidate === entry) return false;
            return isPointInsideBlock(samplePoint, candidate);
        });
    }

    function getFaceEdgeKeys(face) {
        const points = getFaceWorldQuad(face);
        if (points.length < 3) return [];

        const center = points.reduce((acc, point) => acc.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
        const normal = new THREE.Vector3();
        if (points.length >= 3) {
            normal.crossVectors(
                points[1].clone().sub(points[0]),
                points[2].clone().sub(points[0])
            ).normalize();
        }

        let tangent = points[0].clone().sub(center);
        if (tangent.lengthSq() < 1e-8) {
            tangent = new THREE.Vector3(1, 0, 0);
        }
        tangent.normalize();
        let bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
        if (bitangent.lengthSq() < 1e-8) {
            bitangent = new THREE.Vector3(0, 1, 0);
        }

        const orderedPoints = points
            .map((point) => ({
                point,
                angle: Math.atan2(
                    point.clone().sub(center).dot(bitangent),
                    point.clone().sub(center).dot(tangent)
                )
            }))
            .sort((left, right) => left.angle - right.angle)
            .map((item) => item.point);

        const edges = [];
        for (let index = 0; index < orderedPoints.length; index += 1) {
            const currentKey = getVertexKey(orderedPoints[index]);
            const nextKey = getVertexKey(orderedPoints[(index + 1) % orderedPoints.length]);
            edges.push(currentKey < nextKey ? `${currentKey}|${nextKey}` : `${nextKey}|${currentKey}`);
        }
        return edges;
    }

    function getNeighborFaceSelection(nextFace, depth) {
        const entry = nextFace?.data?.entry;
        if (!nextFace || !entry || entry.geometryType !== 'cube' || isImportedBlockFace(nextFace) || !blockManager) {
            return nextFace ? [nextFace] : [];
        }

        const normal = new THREE.Vector3();
        const positions = nextFace.mesh.geometry.attributes.position;
        const index = nextFace.mesh.geometry.index;
        const baseFaceIndex = getBlockMaterialIndex(nextFace) * 2;
        const a = new THREE.Vector3().fromBufferAttribute(positions, index.getX(baseFaceIndex * 3));
        const b = new THREE.Vector3().fromBufferAttribute(positions, index.getX(baseFaceIndex * 3 + 1));
        const c = new THREE.Vector3().fromBufferAttribute(positions, index.getX(baseFaceIndex * 3 + 2));
        normal.crossVectors(c.clone().sub(b), a.clone().sub(b)).normalize();

        const normalMatrix = new THREE.Matrix3().getNormalMatrix(nextFace.mesh.matrixWorld);
        const worldNormal = normal.clone().applyMatrix3(normalMatrix).normalize();
        const planePoint = a.clone().applyMatrix4(nextFace.mesh.matrixWorld);
        const planeD = worldNormal.dot(planePoint);
        const candidates = getCoplanarBlockFaceCandidates(
            blockManager.getBlockEntries().filter((candidate) => candidate.active && candidate.geometryType === 'cube'),
            worldNormal,
            planeD
        );
        const startCandidate = candidates.find((candidate) => candidate.mesh === nextFace.mesh);
        if (!startCandidate) {
            return [nextFace];
        }

        if (depth <= 0) {
            return [{
                mesh: startCandidate.mesh,
                data: { type: 'block', entry: startCandidate.entry },
                faceIndex: startCandidate.faceIndex
            }];
        }

        const uniformGrid = buildUniformFaceGrid(candidates, startCandidate.bounds);
        if (!uniformGrid) {
            return [{
                mesh: startCandidate.mesh,
                data: { type: 'block', entry: startCandidate.entry },
                faceIndex: startCandidate.faceIndex
            }];
        }

        const selectedCandidates = [];
        for (const candidate of candidates) {
            const col = Math.round((candidate.bounds.minU - startCandidate.bounds.minU) / (startCandidate.bounds.maxU - startCandidate.bounds.minU));
            const row = Math.round((candidate.bounds.minV - startCandidate.bounds.minV) / (startCandidate.bounds.maxV - startCandidate.bounds.minV));
            if (Math.max(Math.abs(col), Math.abs(row)) > depth) continue;
            selectedCandidates.push(candidate);
        }

        return selectedCandidates.map((candidate) => ({
            mesh: candidate.mesh,
            data: { type: 'block', entry: candidate.entry },
            faceIndex: candidate.faceIndex
        }));
    }

    function handleFaceHover(nextFace) {
        const isJoint = document.getElementById('joint-face-checkbox')?.checked;

        state.hoveredFace = null;
        clearFacePreviewMeshes(hoveredFacePreviewMeshes);

        if (!nextFace) return;

        let facesToHover = [nextFace];
        if (isNeighborFaceMode()) {
            facesToHover = getNeighborFaceSelection(nextFace, getNeighborFaceDepth());
        } else if (isJoint && nextFace.data && nextFace.data.type === 'block' && !isImportedBlockFace(nextFace)) {
            facesToHover = getJointFaceBlocks(nextFace.mesh, nextFace.faceIndex);
        }

        state.hoveredFace = facesToHover;
        const selectedFaceIds = new Set(getSelectedFaces(state).map((face) => getFaceIdentity(face)));
        const previewFaces = facesToHover.filter((face) => !selectedFaceIds.has(getFaceIdentity(face)));
        setFacePreviewMeshes(hoveredFacePreviewMeshes, previewFaces, FACE_HOVER_EMISSIVE, 0.34);
    }

    function handleFaceSelect(nextFace, event = null) {
        const isJoint = document.getElementById('joint-face-checkbox')?.checked;
        const existingFaces = event?.shiftKey ? getSelectedFaces(state) : [];

        state.selectedFace = null;
        clearFacePreviewMeshes(selectedFacePreviewMeshes);

        if (!nextFace) {
            if (existingFaces.length > 0) {
                state.selectedFace = existingFaces;
                setFacePreviewMeshes(selectedFacePreviewMeshes, existingFaces, FACE_SELECTED_EMISSIVE, 0.52);
            }
            handleFaceHover(state.hoveredFace?.[0] ?? null);
            onUpdate();
            return;
        }

        let facesToSelect = [nextFace];
        if (isNeighborFaceMode()) {
            facesToSelect = getNeighborFaceSelection(nextFace, getNeighborFaceDepth());
        } else if (isJoint && nextFace.data && nextFace.data.type === 'block' && !isImportedBlockFace(nextFace)) {
            facesToSelect = getJointFaceBlocks(nextFace.mesh, nextFace.faceIndex);
        }

        const finalSelection = event?.shiftKey
            ? mergeUniqueFaces(existingFaces, facesToSelect)
            : facesToSelect;

        state.selectedFace = finalSelection;
        setFacePreviewMeshes(selectedFacePreviewMeshes, finalSelection, FACE_SELECTED_EMISSIVE, 0.52);
        handleFaceHover(nextFace);
        onUpdate();
    }

    function getUvTargets(scope = 'selection') {
        if (scope === 'model') {
            const targets = [];
            const seenMeshes = new Set();

            for (const planeData of state.planeFill.values()) {
                if (!planeData?.mesh || seenMeshes.has(planeData.mesh.uuid)) continue;
                seenMeshes.add(planeData.mesh.uuid);
                targets.push({
                    mesh: planeData.mesh,
                    data: { type: 'plane', data: planeData },
                    applyToWholeMesh: true
                });
            }

            for (const [key, mesh] of state.looseFaceMeshes.entries()) {
                if (!mesh || seenMeshes.has(mesh.uuid)) continue;
                seenMeshes.add(mesh.uuid);
                targets.push({
                    mesh,
                    data: { type: 'loose', key },
                    applyToWholeMesh: true
                });
            }

            if (blockManager) {
                for (const entry of blockManager.getBlockEntries()) {
                    if (!entry.active || !entry.mesh || seenMeshes.has(entry.mesh.uuid)) continue;
                    seenMeshes.add(entry.mesh.uuid);
                    targets.push({
                        mesh: entry.mesh,
                        data: { type: entry.geometryType === 'merged-cube' ? 'merged-block' : 'block', entry },
                        applyToWholeMesh: true
                    });
                }
            }

            return targets;
        }

        return getSelectedFaces(state).map((face) => ({
            ...face,
            applyToWholeMesh: shouldTreatFaceAsWholeMesh(face)
        }));
    }


    function handleBlockHover(nextEntry) {
        if (!blockManager) return;
        if (hoveredBlock === nextEntry) return;
        if (hoveredBlock) blockManager.setHovered(hoveredBlock, false);
        hoveredBlock = nextEntry;
        state.hoveredBlock = hoveredBlock;
        if (hoveredBlock) blockManager.setHovered(hoveredBlock, true);
    }

    function clearActiveSelectedEntry() {
        if (!state.selectedEntry) return;
        entryManager.setSelected(state.selectedEntry, false);
        state.selectedEntry = null;
    }

    function clearSelectedPointKeys() {
        for (const key of state.selectedPointKeys) {
            entryManager.setMultiSelectedByKey(key, false);
        }
        state.selectedPointKeys = [];
    }

    function clearPointSelection({ clearActive = true, notify = true } = {}) {
        clearSelectedPointKeys();
        if (clearActive) {
            clearActiveSelectedEntry();
        }
        hideJoinMenu();
        hideLinePreview();
        if (notify) {
            onUpdate();
        }
    }

    function addPointToSelection(entry) {
        const key = getEntryKey(entry);
        if (!key) return;
        if (!state.selectedPointKeys.includes(key)) {
            state.selectedPointKeys.push(key);
            entryManager.setMultiSelectedByKey(key, true);
        }
    }

    function joinSelectedPoints() {
        if (state.controlMode !== 'lines') return false;
        const selectedPositions = state.selectedPointKeys
            .map((key) => ({ key, position: getPointPositionByKey(key) }))
            .filter((item) => item.position);
        if (selectedPositions.length < 2) return false;

        let createdAny = false;
        for (let i = 0; i < selectedPositions.length - 1; i++) {
            const startItem = selectedPositions[i];
            const endItem = selectedPositions[i + 1];
            const pathBeforeOverride = selectedPositions
                .slice(0, i + 1)
                .map((item) => item.position.clone());
            const created = drawLineBetweenPoints({
                state,
                entryManager,
                faceController,
                graphManager,
                blockManager,
                undoManager,
                onUpdate,
                startPoint: startItem.position,
                endPoint: endItem.position,
                pathBeforeOverride
            });
            if (created) {
                createdAny = true;
            }
        }

        clearPointSelection({ clearActive: true, notify: true });
        return createdAny;
    }

    function handleSelect(entry) {
        if (state.selectedEntry && state.selectedEntry !== entry) {
            entryManager.setSelected(state.selectedEntry, false);
        }
        state.selectedEntry = entry;
        if (state.selectedEntry) {
            const preservePath = state.controlMode === 'lines' && pointsEqual(state.currentPosition, state.selectedEntry.position);
            entryManager.setSelected(state.selectedEntry, true);
            state.currentPosition.copy(state.selectedEntry.position);
            state.cursorMesh.position.copy(state.currentPosition);
            if (!preservePath) {
                state.pathPoints = [state.currentPosition.clone()];
            }
            onUpdate();
        }
    }

    function handleBlockSelect(entry, event = null) {
        if (!blockManager) return;
        if (!entry) {
            if (!event?.shiftKey) {
                blockManager.clearSelection();
            }
            onUpdate();
            return;
        }

        if (event?.shiftKey) {
            blockManager.toggleSelection(entry, { makePrimary: true });
        } else {
            blockManager.setSelection([entry], entry);
        }

        if (state.selectedBlock) {
            state.currentPosition.copy(state.selectedBlock.position);
            state.cursorMesh.position.copy(state.currentPosition);
            state.pathPoints = [state.currentPosition.clone()];
        }
        onUpdate();
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
        clearActiveSelectedEntry();
        if (!position) return;
        state.currentPosition.copy(position);
        state.cursorMesh.position.copy(state.currentPosition);
        state.pathPoints = [state.currentPosition.clone()];
        onUpdate();
    }

    function updateLineGeometry(lineEntry) {
        if (!lineEntry || !lineEntry.mesh) return;
        lineEntry.mesh.geometry.setFromPoints([lineEntry.start, lineEntry.end]);
        lineEntry.mesh.geometry.computeBoundingSphere();
    }

    function beginPointDrag(entry, event) {
        if (!entry || !entry.active) return;
        if (entry.source === 'block') return;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
        const axis = getBestAxis(forward);
        if (!axis) return;
        const oldKey = entry.vertexKey ?? getVertexKey(entry.position);
        const pointEntries = entryManager.getPointEntries().filter((item) => {
            const key = item.vertexKey ?? getVertexKey(item.position);
            return key === oldKey;
        });
        const lineSnapshots = [];
        const lineEntries = entryManager.getLineEntries ? entryManager.getLineEntries() : [];
        for (const lineEntry of lineEntries) {
            if (!lineEntry.active) continue;
            const aKey = lineEntry.aKey ?? getVertexKey(lineEntry.start);
            const bKey = lineEntry.bKey ?? getVertexKey(lineEntry.end);
            if (aKey !== oldKey && bKey !== oldKey) continue;
            lineSnapshots.push({
                entry: lineEntry,
                start: lineEntry.start.clone(),
                end: lineEntry.end.clone(),
                aKey,
                bKey,
                isStart: aKey === oldKey,
                isEnd: bKey === oldKey
            });
        }

        dragState = {
            oldKey,
            startPos: entry.position.clone(),
            startMouseY: event.clientY,
            axis,
            pointEntries,
            lineSnapshots,
            lastPos: entry.position.clone()
        };
    }

    function updatePointDrag(event) {
        if (!dragState) return;
        const delta = event.clientY - dragState.startMouseY;
        const newPos = dragState.startPos.clone().add(dragState.axis.clone().multiplyScalar(delta * DRAG_SCALE));
        dragState.lastPos.copy(newPos);

        for (const entry of dragState.pointEntries) {
            entry.position.copy(newPos);
            entry.mesh.position.copy(newPos);
            entryManager.refreshEntryVisibility(entry);
        }

        for (const snapshot of dragState.lineSnapshots) {
            if (snapshot.isStart) {
                snapshot.entry.start.copy(newPos);
            }
            if (snapshot.isEnd) {
                snapshot.entry.end.copy(newPos);
            }
            updateLineGeometry(snapshot.entry);
        }
    }

    function finalizePointDrag() {
        if (!dragState) return;
        const oldKey = dragState.oldKey;
        const oldPos = dragState.startPos.clone();
        const newPos = dragState.lastPos.clone();
        if (newPos.distanceToSquared(oldPos) < 1e-8) {
            dragState = null;
            return;
        }
        const newKey = getVertexKey(newPos);

        entryManager.movePointEntries(oldKey, newKey, newPos);
        if (oldKey !== newKey) {
            state.vertexPositions.delete(oldKey);
        }
        state.vertexPositions.set(newKey, newPos.clone());

        for (const [faceKey, vertices] of state.looseFaceVertices.entries()) {
            if (!vertices.includes(oldKey)) continue;
            const mesh = state.looseFaceMeshes.get(faceKey);
            if (mesh) {
                scene.remove(mesh);
            }
            state.faceRegistry.delete(faceKey);
            state.looseFaceVertices.delete(faceKey);
            state.looseFaceMeshes.delete(faceKey);
        }

        const planesToRemove = [];
        for (const [planeKey, planeData] of state.planeFill.entries()) {
            if (!planeData || !planeData.cells || planeData.cells.size === 0) continue;
            const axis = planeData.axis;
            const value = planeData.value;
            if (Math.abs(oldPos[axis] - value) > FACE_EPSILON) continue;
            let u;
            let v;
            if (axis === 'x') {
                u = oldPos.y;
                v = oldPos.z;
            } else if (axis === 'y') {
                u = oldPos.x;
                v = oldPos.z;
            } else {
                u = oldPos.x;
                v = oldPos.y;
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
            if (planeData.mesh) scene.remove(planeData.mesh);
            if (planeData.gridLines) scene.remove(planeData.gridLines);
            state.planeFill.delete(planeKey);
        }

        if (graphManager && faceController) {
            for (const snapshot of dragState.lineSnapshots) {
                const lineEntry = snapshot.entry;
                const oldPlaneCandidates = getEdgePlaneCandidates(snapshot.start, snapshot.end);
                for (const plane of oldPlaneCandidates) {
                    const planeKey = getPlaneKey(plane.axis, plane.value);
                    graphManager.removeEdge(planeKey, snapshot.aKey, snapshot.bKey);
                }

                const newAKey = snapshot.isStart ? newKey : snapshot.aKey;
                const newBKey = snapshot.isEnd ? newKey : snapshot.bKey;
                lineEntry.aKey = newAKey;
                lineEntry.bKey = newBKey;

                const newPlaneCandidates = getEdgePlaneCandidates(lineEntry.start, lineEntry.end);
                for (const plane of newPlaneCandidates) {
                    const planeKey = getPlaneKey(plane.axis, plane.value);
                    graphManager.addEdge(planeKey, newAKey, newBKey);

                    const path = graphManager.findPath(planeKey, newBKey, newAKey, newAKey, newBKey);
                    if (path && path.length >= 3) {
                        const loopKeys = [newAKey, ...path];
                        if (loopKeys[loopKeys.length - 1] === newAKey) {
                            loopKeys.pop();
                        }
                        const loopPoints = loopKeys
                            .map((key) => state.vertexPositions.get(key))
                            .filter(Boolean);
                        if (loopPoints.length >= 3) {
                            faceController.processLoopFace(loopPoints, planeKey);
                        }
                    }
                }
            }
        }

        const pointPlaneKeys = [
            getPlaneKey('x', oldPos.x),
            getPlaneKey('y', oldPos.y),
            getPlaneKey('z', oldPos.z),
            getPlaneKey('x', newPos.x),
            getPlaneKey('y', newPos.y),
            getPlaneKey('z', newPos.z)
        ];
        for (const planeKey of pointPlaneKeys) {
            entryManager.updatePlaneVisibility(planeKey);
        }

        onUpdate();
        dragState = null;
    }

    function onMouseMove(event) {
        if (state.workMode !== 'classic') {
            handleHover(null);
            handleBlockHover(null);
            handleGridHover(null);
            handleFaceHover(null);
            hideJoinMenu();
            hideLinePreview();
            return;
        }
        updateMouse(event);
        if (clickDragState && (event.buttons & 1) !== 0) {
            const dx = event.clientX - clickDragState.startX;
            const dy = event.clientY - clickDragState.startY;
            if ((dx * dx) + (dy * dy) > 16) {
                clickDragState.moved = true;
            }
        }
        if (dragState) {
            event.preventDefault();
            event.stopPropagation();
            updatePointDrag(event);
            return;
        }
        
        if (state.controlMode === 'select-face' || state.controlMode === 'select-face-neighbors') {
            const face = pickFace();
            handleFaceHover(face);
            handleBlockHover(null);
            handleHover(null);
            handleGridHover(null);
            hideJoinMenu();
            hideLinePreview();
            return;
        }

        if (state.controlMode !== 'lines') {
            const blockEntry = pickBlockEntry();
            handleBlockHover(blockEntry);
            handleHover(null);
            handleGridHover(null);
            handleFaceHover(null);
            hideJoinMenu();
            hideLinePreview();
            return;
        }
        const entry = pickEntry(true);
        if (entry) {
            handleHover(entry);
            handleGridHover(null);
            handleFaceHover(null);
            handleLinePreview(entry.position);
            return;
        }
        handleHover(null);
        handleFaceHover(null);
        const gridPoint = pickGridPoint();
        handleGridHover(gridPoint);
        handleLinePreview(gridPoint);
    }

    function onClick(event) {
        if (state.workMode !== 'classic') {
            hideJoinMenu();
            hideLinePreview();
            return;
        }
        updateMouse(event);
        if (suppressClick) {
            suppressClick = false;
            return;
        }
        
        if (state.controlMode === 'select-face' || state.controlMode === 'select-face-neighbors') {
            hideJoinMenu();
            hideLinePreview();
            const face = pickFace();
            handleFaceSelect(face, event);
            return;
        }

        if (state.controlMode === 'blocks-keyboard') {
            hideJoinMenu();
            hideLinePreview();
            const blockEntry = pickBlockEntry();
            handleBlockSelect(blockEntry, event);
            handleBlockHover(null);
            handleGridHover(null);
            return;
        }
        if (state.controlMode === 'blocks-mouse') {
            hideJoinMenu();
            hideLinePreview();
            handleBlockHover(null);
            handleGridHover(null);
            return;
        }
        const entry = pickEntry(true);
        if (event.shiftKey) {
            if (!entry) {
                hideJoinMenu();
                return;
            }
            addPointToSelection(entry);
            handleSelect(entry);
            handleGridHover(null);
            handleLinePreview(entry.position);
            return;
        }
        if (entry) {
            hideJoinMenu();
            handleSelect(entry);
            handleGridHover(null);
            handleLinePreview(entry.position);
            return;
        }
        hideJoinMenu();
        const gridPoint = pickGridPoint();
        handleGridSelect(gridPoint);
        handleGridHover(null);
        handleLinePreview(gridPoint);
    }

    function onContextMenu(event) {
        if (state.workMode !== 'classic') {
            hideJoinMenu();
            return;
        }
        if (state.controlMode !== 'lines') {
            hideJoinMenu();
            return;
        }
        if (state.selectedPointKeys.length < 2) {
            hideJoinMenu();
            event.preventDefault();
            return;
        }
        event.preventDefault();
        showJoinMenu(event.clientX + 6, event.clientY + 6);
    }

    function onDocumentPointerDown(event) {
        if (joinMenu.style.display === 'none') return;
        if (joinMenu.contains(event.target)) return;
        hideJoinMenu();
    }

    function onDocumentClick(event) {
        if (typeof event.button === 'number' && event.button !== 0) return;
        if (event.shiftKey) return;
        if (suppressClick) {
            suppressClick = false;
            return;
        }
        if (dragState) return;
        if (joinMenu.contains(event.target)) return;
        if (state.selectedPointKeys.length === 0) return;
        clearPointSelection({ clearActive: true, notify: true });
    }

    function onPointerDown(event) {
        if (state.workMode !== 'classic') return;
        if (event.button !== 0) return;
        clickDragState = {
            startX: event.clientX,
            startY: event.clientY,
            moved: false
        };
    }

    function onPointerUp(event) {
        if (clickDragState) {
            if (clickDragState.moved) {
                suppressClick = true;
            }
            clickDragState = null;
        }
        if (!dragState) return;
        const moved = Math.abs(event.clientY - dragState.startMouseY) > 2;
        suppressClick = moved;
        finalizePointDrag();
        event.preventDefault();
        event.stopPropagation();
    }

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointerdown', onDocumentPointerDown);
    document.addEventListener('click', onDocumentClick, true);

    joinAction.addEventListener('click', () => {
        if (!joinSelectedPoints()) {
            hideJoinMenu();
        }
    });

    return {
        clearSelection: () => {
            if (hoveredEntry) entryManager.setHovered(hoveredEntry, false);
            clearActiveSelectedEntry();
            clearSelectedPointKeys();
            hoveredEntry = null;
            state.hoveredEntry = null;
            if (blockManager) {
                if (hoveredBlock) blockManager.setHovered(hoveredBlock, false);
                blockManager.clearSelection();
                hoveredBlock = null;
                state.hoveredBlock = null;
            }
            hideJoinMenu();
            handleFaceSelect(null);
            handleFaceHover(null);
            clearFacePreviewMeshes(hoveredFacePreviewMeshes);
            clearFacePreviewMeshes(selectedFacePreviewMeshes);
            gridHoverMesh.visible = false;
            hideLinePreview();
        },
        clearPointSelection: () => {
            clearPointSelection();
        },
        hasUvTarget: (scope = 'selection') => {
            return getUvTargets(scope).length > 0;
        },
        getTargetTexture: (scope = 'selection') => {
            return getSelectionTexture(getUvTargets(scope));
        },
        getUvEditorSession: (scope = 'selection', fallbackTexture = null) => {
            return createUvEditorSession(getUvTargets(scope), fallbackTexture);
        },
        applyTexture: (scope = 'selection', texture) => {
            const targets = getUvTargets(scope);
            if (targets.length === 0) return false;
            const preserveUvLayout = targets.every((face) => Boolean(getFaceMaterial(face)?.map));
            const applied = assignTextureToFaces(targets, texture, { preserveUvLayout });
            if (applied) {
                onUpdate();
            }
            return applied;
        },
        updateTextureTransform: (scope = 'selection', texture) => {
            const targets = getUvTargets(scope).filter((face) => Boolean(getFaceMaterial(face)?.map));
            if (targets.length === 0) return false;
            const updated = assignTextureToFaces(targets, texture, { preserveUvLayout: true });
            if (updated) {
                onUpdate();
            }
            return updated;
        }
    };
}
