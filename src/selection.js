import * as THREE from 'three';
import { getBestAxis, getVertexKey, getEdgePlaneCandidates, getPlaneKey, pointsEqual } from './geometry.js';
import { FACE_EPSILON, STEP_SIZE } from './constants.js';
import { drawLineBetweenPoints } from './input.js';

const FACE_HOVER_EMISSIVE = 0x333333;
const FACE_SELECTED_EMISSIVE = 0x555500;

function getSelectedFaces(state) {
    if (!state.selectedFace) return [];
    return Array.isArray(state.selectedFace) ? state.selectedFace : [state.selectedFace];
}

function getBlockMaterialIndex(face) {
    if (typeof face?.faceIndex !== 'number') return 0;
    return Math.floor(face.faceIndex / 2);
}

function getFaceMaterial(face) {
    if (!face?.mesh?.material) return null;
    if (Array.isArray(face.mesh.material)) {
        if (face.applyToWholeMesh) {
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

function collectUvTargets(selectedFaces) {
    return selectedFaces.map((face) => {
        const mesh = face.mesh;
        if (face.data?.type === 'block') {
            ensureUniqueGeometry(mesh);
            ensureEditableBlockMaterials(mesh);
        }

        const geometry = mesh.geometry;
        const uvAttribute = ensureUvAttribute(geometry);
        const triangles = face.data?.type === 'block' && !face.applyToWholeMesh
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

function assignTextureToFaces(selectedFaces, texture) {
    if (!texture || selectedFaces.length === 0) return false;

    const targets = collectUvTargets(selectedFaces);
    const fittedMap = buildFittedUvMap(targets);

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

    applyUvPointMap(targets, fittedMap);
    selectedFaces.forEach((face) => {
        if (!face.applyToWholeMesh) {
            setFaceEmissive(face, FACE_SELECTED_EMISSIVE);
        }
    });
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
        assignTextureToFaces(selectedFaces, sourceTexture);
    }

    const targets = collectUvTargets(selectedFaces);
    const resetMap = buildFittedUvMap(targets);
    const payload = buildUvEditorPayload(targets);

    return {
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
    let suppressClick = false;

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
                    planeByMesh.set(entry.mesh, { type: 'block', entry });
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

    // Helper to get contiguous blocks that share the same normal and are adjacent
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
        
        const allBlocks = blockManager.getBlockEntries().filter(e => e.active);
        
        // Flood fill variables
        const result = [];
        const visited = new Set();
        const queue = [ startMesh ];
        visited.add(startMesh.uuid);
        
        // We find the face index for a given normal
        function getFaceIndexForNormal(mesh, targetNormal) {
            const geom = mesh.geometry;
            const _normal = new THREE.Vector3();
            const _nMat = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
            
            // BoxGeometry has 12 faces (triangles), 2 per side. 6 sides total.
            for (let i = 0; i < geom.index.count / 3; i+=2) {
                const _a = new THREE.Vector3().fromBufferAttribute(geom.attributes.position, geom.index.getX(i * 3));
                const _b = new THREE.Vector3().fromBufferAttribute(geom.attributes.position, geom.index.getX(i * 3 + 1));
                const _c = new THREE.Vector3().fromBufferAttribute(geom.attributes.position, geom.index.getX(i * 3 + 2));
                
                const _cb = new THREE.Vector3().subVectors(_c, _b);
                const _ab = new THREE.Vector3().subVectors(_a, _b);
                _normal.crossVectors(_cb, _ab).normalize();
                const _wNormal = _normal.clone().applyMatrix3(_nMat).normalize();
                
                // If normals match
                if (_wNormal.dot(targetNormal) > 0.99) {
                    // Check if coplanar
                    const _p = _a.clone().applyMatrix4(mesh.matrixWorld);
                    if (Math.abs(targetNormal.dot(_p) - planeD) < 1e-4) {
                        return i; // Return the first triangle of the quad
                    }
                }
            }
            return -1;
        }
        
        while (queue.length > 0) {
            const currentMesh = queue.shift();
            const currentEntry = blockManager.getBlockByMesh(currentMesh);
            if (!currentEntry) continue;
            
            const fIndex = getFaceIndexForNormal(currentMesh, worldNormal);
            if (fIndex === -1) continue; // Face is not on the same plane
            
            result.push({ mesh: currentMesh, data: { type: 'block', entry: currentEntry }, faceIndex: fIndex });
            
            // Find adjacent blocks
            const size = currentEntry.size;
            
            for (const other of allBlocks) {
                if (visited.has(other.mesh.uuid)) continue;
                if (other.size !== size) continue; // Simplify: only same-sized blocks connect perfectly
                
                // Are they adjacent? (Distance is exactly 'size' in one axis, 0 in others)
                const dx = Math.abs(currentEntry.position.x - other.position.x);
                const dy = Math.abs(currentEntry.position.y - other.position.y);
                const dz = Math.abs(currentEntry.position.z - other.position.z);
                
                // Check if they are exactly adjacent (share a face)
                const dSum = dx + dy + dz;
                const isAdjacent = Math.abs(dSum - size) < 1e-4 && 
                                   ((dx < 1e-4 && dy < 1e-4) || 
                                    (dx < 1e-4 && dz < 1e-4) || 
                                    (dy < 1e-4 && dz < 1e-4));
                                    
                if (isAdjacent) {
                    visited.add(other.mesh.uuid);
                    queue.push(other.mesh);
                }
            }
        }
        return result;
    }

    function handleFaceHover(nextFace) {
        const isJoint = document.getElementById('joint-face-checkbox')?.checked;
        
        // Revert previous hover
        if (state.hoveredFace) {
            const facesToRevert = Array.isArray(state.hoveredFace) ? state.hoveredFace : [state.hoveredFace];
            facesToRevert.forEach(face => {
                if (!face) return;
                clearMeshEmissive(face.mesh);
            });
            state.hoveredFace = null;
        }

        if (!nextFace) return;
        
        let facesToHover = [nextFace];
        if (isJoint && nextFace.data && nextFace.data.type === 'block') {
            facesToHover = getJointFaceBlocks(nextFace.mesh, nextFace.faceIndex);
        }
        
        state.hoveredFace = facesToHover;

        // Apply new hover
        facesToHover.forEach(face => {
            let isSelected = false;
            if (state.selectedFace) {
                const selFaces = Array.isArray(state.selectedFace) ? state.selectedFace : [state.selectedFace];
                isSelected = selFaces.some(sf => sf.mesh === face.mesh && sf.faceIndex === face.faceIndex);
            }
            
            if (!isSelected) {
                setFaceEmissive(face, FACE_HOVER_EMISSIVE);
            }
        });
        
        // Ensure selected faces remain yellow
        if (state.selectedFace) {
            const selFaces = Array.isArray(state.selectedFace) ? state.selectedFace : [state.selectedFace];
            selFaces.forEach(face => {
                 setFaceEmissive(face, FACE_SELECTED_EMISSIVE);
            });
        }
    }

    function handleFaceSelect(nextFace) {
        const isJoint = document.getElementById('joint-face-checkbox')?.checked;
        
        if (state.selectedFace) {
             const facesToRevert = Array.isArray(state.selectedFace) ? state.selectedFace : [state.selectedFace];
             facesToRevert.forEach(face => {
                 clearMeshEmissive(face.mesh);
             });
             state.selectedFace = null;
        }

        if (!nextFace) {
            onUpdate();
            return;
        }
        
        let facesToSelect = [nextFace];
        if (isJoint && nextFace.data && nextFace.data.type === 'block') {
            facesToSelect = getJointFaceBlocks(nextFace.mesh, nextFace.faceIndex);
        }

        state.selectedFace = facesToSelect;

        facesToSelect.forEach(face => {
             setFaceEmissive(face, FACE_SELECTED_EMISSIVE);
        });
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
                        data: { type: 'block', entry },
                        applyToWholeMesh: true
                    });
                }
            }

            return targets;
        }

        return getSelectedFaces(state).map((face) => ({
            ...face,
            applyToWholeMesh: false
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

    function handleBlockSelect(entry) {
        if (!blockManager) return;
        if (!entry) {
            onUpdate();
            return;
        }
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
        if (dragState) {
            event.preventDefault();
            event.stopPropagation();
            updatePointDrag(event);
            return;
        }
        
        if (state.controlMode === 'select-face') {
            const face = pickFace();
            handleFaceHover(face);
            handleBlockHover(null);
            handleHover(null);
            handleGridHover(null);
            hideJoinMenu();
            hideLinePreview();
            return;
        }

        if (state.controlMode === 'points') {
            const entry = pickEntry(true);
            handleHover(entry);
            handleBlockHover(null);
            handleGridHover(null);
            handleFaceHover(null);
            hideJoinMenu();
            hideLinePreview();
            return;
        }

        if (state.controlMode === 'sculpt') {
            handleHover(null);
            handleBlockHover(null);
            handleGridHover(null);
            handleFaceHover(null);
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
        
        if (state.controlMode === 'select-face') {
            hideJoinMenu();
            hideLinePreview();
            const face = pickFace();
            handleFaceSelect(face);
            return;
        }

        if (state.controlMode === 'points') {
            hideJoinMenu();
            hideLinePreview();
            const entry = pickEntry(true);
            handleSelect(entry);
            handleGridHover(null);
            handleFaceHover(null);
            return;
        }

        if (state.controlMode === 'blocks-keyboard') {
            hideJoinMenu();
            hideLinePreview();
            const blockEntry = pickBlockEntry();
            handleBlockSelect(blockEntry);
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
        if (state.controlMode === 'sculpt') {
            hideJoinMenu();
            hideLinePreview();
            handleHover(null);
            handleBlockHover(null);
            handleGridHover(null);
            handleFaceHover(null);
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

    function onPointerDown(event) {
        if (state.workMode !== 'classic') return;
        if (event.button !== 0) return;
        if (state.controlMode !== 'points') return;
        if (!event.shiftKey) return;
        updateMouse(event);
        const entry = pickEntry(true);
        if (!entry) return;
        handleSelect(entry);
        beginPointDrag(entry, event);
        event.preventDefault();
        event.stopPropagation();
    }

    function onPointerUp(event) {
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
                if (state.selectedBlock) blockManager.setSelected(state.selectedBlock, false);
                hoveredBlock = null;
                state.selectedBlock = null;
                state.hoveredBlock = null;
            }
            hideJoinMenu();
            handleFaceSelect(null);
            handleFaceHover(null);
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
            const applied = assignTextureToFaces(targets, texture);
            if (applied) {
                onUpdate();
            }
            return applied;
        }
    };
}
