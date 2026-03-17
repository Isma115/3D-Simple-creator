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
                // If a face is selected, do not revert its hover state if it's the exact same face. 
                // However, joint selection makes this tricky, so we rely on exact mesh material array modification properly.
                // We'll revert all hover emissions back to 0. (Selected emission is handled separately below).
                if (face.mesh.material.emissive) {
                     face.mesh.material.emissive.setHex(0x000000);
                } else if (Array.isArray(face.mesh.material)) {
                     face.mesh.material.forEach(m => {
                         if (m.emissive) m.emissive.setHex(0x000000);
                     });
                }
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
            // Check if this specific face is part of the selection. If so, skip hover highlighting to keep selection highlight.
            let isSelected = false;
            if (state.selectedFace) {
                const selFaces = Array.isArray(state.selectedFace) ? state.selectedFace : [state.selectedFace];
                isSelected = selFaces.some(sf => sf.mesh === face.mesh); // Oversimplification, but good enough for visual
            }
            
            if (!isSelected) {
                if (face.mesh.material.emissive) {
                    face.mesh.material.emissive.setHex(0x333333); // Highlight color
                } else if (Array.isArray(face.mesh.material)) {
                    // Highlight the specific material face if it's an array
                    const materialIndex = Math.floor(face.faceIndex / 2);
                    if (face.mesh.material[materialIndex].emissive) {
                        face.mesh.material[materialIndex].emissive.setHex(0x333333);
                    }
                }
            }
        });
        
        // Ensure selected faces remain yellow
        if (state.selectedFace) {
            const selFaces = Array.isArray(state.selectedFace) ? state.selectedFace : [state.selectedFace];
            selFaces.forEach(face => {
                 if (face.mesh.material.emissive) {
                     face.mesh.material.emissive.setHex(0x555500); 
                 } else if (Array.isArray(face.mesh.material)) {
                    const materialIndex = Math.floor(face.faceIndex / 2);
                    if (face.mesh.material[materialIndex].emissive) {
                        face.mesh.material[materialIndex].emissive.setHex(0x555500);
                    }
                 }
            });
        }
    }

    function handleFaceSelect(nextFace) {
        const isJoint = document.getElementById('joint-face-checkbox')?.checked;
        
        if (state.selectedFace) {
             const facesToRevert = Array.isArray(state.selectedFace) ? state.selectedFace : [state.selectedFace];
             facesToRevert.forEach(face => {
                 if (face.mesh.material.emissive) {
                     face.mesh.material.emissive.setHex(0x000000);
                 } else if (Array.isArray(face.mesh.material)) {
                     face.mesh.material.forEach(m => {
                         if (m.emissive) m.emissive.setHex(0x000000);
                     });
                 }
             });
             state.selectedFace = null;
        }

        if (!nextFace) return;
        
        let facesToSelect = [nextFace];
        if (isJoint && nextFace.data && nextFace.data.type === 'block') {
            facesToSelect = getJointFaceBlocks(nextFace.mesh, nextFace.faceIndex);
        }

        state.selectedFace = facesToSelect;

        facesToSelect.forEach(face => {
             if (face.mesh.material.emissive) {
                 face.mesh.material.emissive.setHex(0x555500); // Selected color (yellowish)
             } else if (Array.isArray(face.mesh.material)) {
                // Highlight the specific material face if it's an array
                const materialIndex = Math.floor(face.faceIndex / 2);
                if (face.mesh.material[materialIndex].emissive) {
                    face.mesh.material[materialIndex].emissive.setHex(0x555500);
                }
             }
        });
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
        
        if (state.controlMode === 'select-face') {
            const face = pickFace();
            handleFaceHover(face);
            handleBlockHover(null);
            handleHover(null);
            handleGridHover(null);
            return;
        }

        if (state.controlMode !== 'lines') {
            const blockEntry = pickBlockEntry();
            handleBlockHover(blockEntry);
            handleHover(null);
            handleGridHover(null);
            handleFaceHover(null);
            return;
        }
        const entry = pickEntry();
        if (entry) {
            handleHover(entry);
            handleGridHover(null);
            handleFaceHover(null);
            return;
        }
        handleHover(null);
        handleFaceHover(null);
        const gridPoint = pickGridPoint();
        handleGridHover(gridPoint);
    }

    function onClick(event) {
        updateMouse(event);
        
        if (state.controlMode === 'select-face') {
            const face = pickFace();
            handleFaceSelect(face);
            return;
        }

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
            handleFaceSelect(null);
            handleFaceHover(null);
            gridHoverMesh.visible = false;
        },
        applyTextureToSelected: (texture) => {
            if (!state.selectedFace) return;
            
            const selFaces = Array.isArray(state.selectedFace) ? state.selectedFace : [state.selectedFace];
            if (selFaces.length === 0) return;

            // Determine if these form a contiguous joint block face
            const isJointBlockFace = selFaces.length > 1 && selFaces[0].data && selFaces[0].data.type === 'block';
            
            let minU = Infinity, minV = Infinity, maxU = -Infinity, maxV = -Infinity;
            const uDir = new THREE.Vector3(0, 0, 0);
            const vDir = new THREE.Vector3(0, 0, 0);
            
            if (isJointBlockFace) {
                // Determine the normal plane and a stable UV-aligned basis
                const normalObj = selFaces[0];
                const geom = normalObj.mesh.geometry;
                const positions = geom.attributes.position;
                const uvs = geom.attributes.uv;
                const index = geom.index;

                const i0 = index.getX(normalObj.faceIndex * 3);
                const i1 = index.getX(normalObj.faceIndex * 3 + 1);
                const i2 = index.getX(normalObj.faceIndex * 3 + 2);

                const a = new THREE.Vector3().fromBufferAttribute(positions, i0);
                const b = new THREE.Vector3().fromBufferAttribute(positions, i1);
                const c = new THREE.Vector3().fromBufferAttribute(positions, i2);

                const cb = new THREE.Vector3().subVectors(c, b);
                const ab = new THREE.Vector3().subVectors(a, b);
                const localNormal = new THREE.Vector3().crossVectors(cb, ab).normalize();
                const normalMatrix = new THREE.Matrix3().getNormalMatrix(normalObj.mesh.matrixWorld);
                const worldNormal = localNormal.clone().applyMatrix3(normalMatrix).normalize();
                
                if (uvs) {
                    const p0 = a.clone().applyMatrix4(normalObj.mesh.matrixWorld);
                    const p1 = b.clone().applyMatrix4(normalObj.mesh.matrixWorld);
                    const p2 = c.clone().applyMatrix4(normalObj.mesh.matrixWorld);

                    const uv0 = new THREE.Vector2().fromBufferAttribute(uvs, i0);
                    const uv1 = new THREE.Vector2().fromBufferAttribute(uvs, i1);
                    const uv2 = new THREE.Vector2().fromBufferAttribute(uvs, i2);

                    const deltaPos1 = p1.clone().sub(p0);
                    const deltaPos2 = p2.clone().sub(p0);
                    const deltaUV1 = uv1.clone().sub(uv0);
                    const deltaUV2 = uv2.clone().sub(uv0);
                    const denom = (deltaUV1.x * deltaUV2.y - deltaUV1.y * deltaUV2.x);

                    if (Math.abs(denom) > 1e-6) {
                        const r = 1 / denom;
                        const tangent = deltaPos1.clone().multiplyScalar(deltaUV2.y)
                            .sub(deltaPos2.clone().multiplyScalar(deltaUV1.y))
                            .multiplyScalar(r)
                            .normalize();
                        const bitangent = deltaPos2.clone().multiplyScalar(deltaUV1.x)
                            .sub(deltaPos1.clone().multiplyScalar(deltaUV2.x))
                            .multiplyScalar(r)
                            .normalize();

                        uDir.copy(tangent);
                        // Orthonormalize V against U and normal, preserving UV orientation
                        vDir.copy(new THREE.Vector3().crossVectors(worldNormal, uDir).normalize());
                        if (vDir.dot(bitangent) < 0) vDir.negate();
                    }
                }

                if (uDir.lengthSq() < 1e-6 || vDir.lengthSq() < 1e-6) {
                    // Fallback: axis-aligned basis by dominant normal
                    if (Math.abs(worldNormal.x) > 0.9) {
                        uDir.set(0, 0, 1);
                        vDir.set(0, 1, 0);
                    } else if (Math.abs(worldNormal.y) > 0.9) {
                        uDir.set(1, 0, 0);
                        vDir.set(0, 0, 1);
                    } else {
                        uDir.set(1, 0, 0);
                        vDir.set(0, 1, 0);
                    }
                }

                // Calculate bounding box in that 2D projection
                selFaces.forEach(face => {
                    const pos = face.mesh.getWorldPosition(new THREE.Vector3());
                    const size = face.data.entry.size;
                    const half = size / 2;
                    
                    const u = pos.dot(uDir);
                    const v = pos.dot(vDir);
                    const uExtent = half * (Math.abs(uDir.x) + Math.abs(uDir.y) + Math.abs(uDir.z));
                    const vExtent = half * (Math.abs(vDir.x) + Math.abs(vDir.y) + Math.abs(vDir.z));
                    
                    minU = Math.min(minU, u - uExtent);
                    maxU = Math.max(maxU, u + uExtent);
                    minV = Math.min(minV, v - vExtent);
                    maxV = Math.max(maxV, v + vExtent);
                });
            }

            const totalWidth = isJointBlockFace ? (maxU - minU) : 1;
            const totalHeight = isJointBlockFace ? (maxV - minV) : 1;
            
            selFaces.forEach(face => {
                const targetMesh = face.mesh;
                
                // Clone the texture so we can modify its offset and repeat per block without affecting others
                const blockTexture = texture.clone();
                blockTexture.needsUpdate = true;
                
                if (isJointBlockFace) {
                    const pos = face.mesh.getWorldPosition(new THREE.Vector3());
                    const size = face.data.entry.size;
                    const half = size / 2;
                    const u = pos.dot(uDir);
                    const v = pos.dot(vDir);
                    const uExtent = half * (Math.abs(uDir.x) + Math.abs(uDir.y) + Math.abs(uDir.z));
                    const vExtent = half * (Math.abs(vDir.x) + Math.abs(vDir.y) + Math.abs(vDir.z));
                    const blockMinU = u - uExtent;
                    const blockMinV = v - vExtent;
                    
                    // The percentage of the block's width relative to the whole wall
                    blockTexture.repeat.set((uExtent * 2) / totalWidth, (vExtent * 2) / totalHeight);
                    // The bottom-left normalized offset
                    blockTexture.offset.set((blockMinU - minU) / totalWidth, (blockMinV - minV) / totalHeight);
                }
                
                // To apply texture uniquely we need to clone the material 
                // so we don't apply it to all faces sharing the same material
                if (face.data && face.data.type === 'block') {
                    if (!Array.isArray(targetMesh.material)) {
                        const mat = targetMesh.material;
                        targetMesh.material = [
                            mat.clone(), mat.clone(), mat.clone(), 
                            mat.clone(), mat.clone(), mat.clone()
                        ];
                    }
                    
                    const materialIndex = Math.floor(face.faceIndex / 2);
                    const mat = targetMesh.material[materialIndex].clone();
                    mat.map = blockTexture;
                    mat.needsUpdate = true;
                    targetMesh.material[materialIndex] = mat;
                    
                } else {
                    // Plane or Loose face
                    const mat = targetMesh.material.clone();
                    mat.map = blockTexture;
                    mat.needsUpdate = true;
                    targetMesh.material = mat;
                }
            });
            // Re-apply the selected visual highlight since we replaced the material
            const tempSelected = state.selectedFace;
            state.selectedFace = null;
            handleFaceSelect(null);
            
            // Re-apply
            state.selectedFace = tempSelected;
            selFaces.forEach(face => {
                 if (face.mesh.material.emissive) {
                     face.mesh.material.emissive.setHex(0x555500); // Selected color (yellowish)
                 } else if (Array.isArray(face.mesh.material)) {
                    const materialIndex = Math.floor(face.faceIndex / 2);
                    if (face.mesh.material[materialIndex].emissive) {
                        face.mesh.material[materialIndex].emissive.setHex(0x555500);
                    }
                 }
            });
        }
    };
}
