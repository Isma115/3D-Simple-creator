import * as THREE from 'three';
import { clearCurrentModel } from './import.js';
import { getEdgePlaneCandidates, getPlaneKey, getVertexKey } from './geometry.js';

function createLine(state, start, end) {
    const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geometry, state.lineMaterial);
    line.renderOrder = 10;
    return line;
}

function createPointMarker(state, position) {
    const point = new THREE.Mesh(state.pointGeometry, state.pointMaterial.clone());
    point.position.copy(position);
    point.renderOrder = 2;
    return point;
}

function normalizeControlMode(mode) {
    return mode === 'points' ? 'lines' : mode;
}

function vectorToData(vector) {
    return { x: vector.x, y: vector.y, z: vector.z };
}

function vector2ToData(vector) {
    return { x: vector.x, y: vector.y };
}

function dataToVector(data) {
    return new THREE.Vector3(data?.x ?? 0, data?.y ?? 0, data?.z ?? 0);
}

function dataToVector2(data) {
    return new THREE.Vector2(data?.x ?? 0, data?.y ?? 0);
}

function attributeToData(attribute) {
    if (!attribute) return null;
    return {
        itemSize: attribute.itemSize,
        array: Array.from(attribute.array)
    };
}

function dataToAttribute(attributeData) {
    if (!attributeData) return null;
    return new THREE.Float32BufferAttribute(attributeData.array, attributeData.itemSize);
}

function geometryToData(geometry) {
    if (!geometry) return null;
    return {
        position: attributeToData(geometry.getAttribute('position')),
        normal: attributeToData(geometry.getAttribute('normal')),
        uv: attributeToData(geometry.getAttribute('uv')),
        index: geometry.index ? Array.from(geometry.index.array) : null,
        groups: geometry.groups.map((group) => ({ ...group }))
    };
}

function dataToGeometry(geometryData) {
    if (!geometryData?.position) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', dataToAttribute(geometryData.position));
    if (geometryData.normal) {
        geometry.setAttribute('normal', dataToAttribute(geometryData.normal));
    }
    if (geometryData.uv) {
        geometry.setAttribute('uv', dataToAttribute(geometryData.uv));
    }
    if (Array.isArray(geometryData.index)) {
        geometry.setIndex(geometryData.index);
    }
    geometry.clearGroups();
    for (const group of geometryData.groups ?? []) {
        geometry.addGroup(group.start, group.count, group.materialIndex);
    }
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    if (!geometry.getAttribute('normal')) {
        geometry.computeVertexNormals();
    }
    return geometry;
}

async function imageToDataUrl(image) {
    if (!image) return null;
    if (typeof image.src === 'string' && image.src.startsWith('data:')) {
        return image.src;
    }
    if (typeof image.toDataURL === 'function') {
        return image.toDataURL('image/png');
    }

    const canvas = document.createElement('canvas');
    canvas.width = image.width || image.naturalWidth || 512;
    canvas.height = image.height || image.naturalHeight || 512;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
}

async function textureToData(texture) {
    if (!texture?.image) return null;
    return {
        dataUrl: await imageToDataUrl(texture.image),
        wrapS: texture.wrapS,
        wrapT: texture.wrapT,
        repeat: vector2ToData(texture.repeat ?? new THREE.Vector2(1, 1)),
        offset: vector2ToData(texture.offset ?? new THREE.Vector2(0, 0)),
        center: vector2ToData(texture.center ?? new THREE.Vector2(0, 0)),
        rotation: texture.rotation ?? 0,
        flipY: texture.flipY ?? true
    };
}

async function materialToData(material) {
    if (Array.isArray(material)) {
        return await Promise.all(material.map((item) => materialToData(item)));
    }
    if (!material) return null;
    return {
        type: material.type ?? 'MeshStandardMaterial',
        color: material.color?.getHex?.() ?? null,
        emissive: material.emissive?.getHex?.() ?? null,
        roughness: material.roughness ?? null,
        metalness: material.metalness ?? null,
        opacity: material.opacity ?? 1,
        transparent: material.transparent ?? false,
        side: material.side ?? THREE.FrontSide,
        map: await textureToData(material.map)
    };
}

async function textureFromData(textureData, textureLoader) {
    if (!textureData?.dataUrl) return null;
    const texture = await new Promise((resolve, reject) => {
        textureLoader.load(textureData.dataUrl, resolve, undefined, reject);
    });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = textureData.wrapS ?? THREE.RepeatWrapping;
    texture.wrapT = textureData.wrapT ?? THREE.RepeatWrapping;
    texture.repeat.copy(dataToVector2(textureData.repeat));
    texture.offset.copy(dataToVector2(textureData.offset));
    texture.center.copy(dataToVector2(textureData.center));
    texture.rotation = textureData.rotation ?? 0;
    texture.flipY = textureData.flipY ?? true;
    texture.needsUpdate = true;
    return texture;
}

async function materialFromData(materialData, textureLoader) {
    if (Array.isArray(materialData)) {
        return await Promise.all(materialData.map((item) => materialFromData(item, textureLoader)));
    }
    if (!materialData) {
        return new THREE.MeshStandardMaterial({ color: 0xbcbcbc });
    }

    const MaterialCtor = THREE[materialData.type] ?? THREE.MeshStandardMaterial;
    const material = new MaterialCtor();
    if (material.color && materialData.color !== null) {
        material.color.setHex(materialData.color);
    }
    if (material.emissive && materialData.emissive !== null) {
        material.emissive.setHex(materialData.emissive);
    }
    if ('roughness' in material && materialData.roughness !== null) {
        material.roughness = materialData.roughness;
    }
    if ('metalness' in material && materialData.metalness !== null) {
        material.metalness = materialData.metalness;
    }
    material.opacity = materialData.opacity ?? 1;
    material.transparent = Boolean(materialData.transparent);
    material.side = materialData.side ?? THREE.FrontSide;
    material.map = await textureFromData(materialData.map, textureLoader);
    material.needsUpdate = true;
    return material;
}

function meshTransformToData(mesh) {
    return {
        position: vectorToData(mesh.position),
        rotation: vectorToData(mesh.rotation),
        scale: vectorToData(mesh.scale)
    };
}

function applyMeshTransform(mesh, transform = {}) {
    mesh.position.copy(dataToVector(transform.position));
    mesh.rotation.set(
        transform.rotation?.x ?? 0,
        transform.rotation?.y ?? 0,
        transform.rotation?.z ?? 0
    );
    mesh.scale.copy(dataToVector(transform.scale ?? { x: 1, y: 1, z: 1 }));
}

function meshToSnapshot(mesh) {
    return {
        geometry: geometryToData(mesh.geometry),
        transform: meshTransformToData(mesh)
    };
}

async function saveTextFile(text, filename) {
    const blob = new Blob([text], { type: 'application/json' });

    if (window.pywebview?.api?.save_export_file) {
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error ?? new Error('No se pudo preparar el proyecto para guardar.'));
            reader.readAsDataURL(blob);
        });
        const result = await window.pywebview.api.save_export_file(dataUrl, filename, 'Proyecto Simple3D (*.s3dc)');
        if (result?.saved || result?.cancelled) {
            return;
        }
        throw new Error(result?.error ?? 'No se pudo guardar el proyecto.');
    }

    const link = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    link.style.display = 'none';
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function serializePointEntries(entryManager) {
    const byVertexKey = new Map();

    for (const entry of entryManager.getPointEntries()) {
        if (!entry.active || !entry.vertexKey) continue;
        if (byVertexKey.has(entry.vertexKey)) continue;
        byVertexKey.set(entry.vertexKey, {
            vertexKey: entry.vertexKey,
            position: vectorToData(entry.position),
            source: entry.source ?? 'line'
        });
    }

    return Array.from(byVertexKey.values());
}

function serializeBlockGeometryState(entry, state) {
    const builtInGeometry = state.geometries?.[entry.geometryType] ?? null;
    const usesCustomGeometry = !builtInGeometry || entry.geometryType?.startsWith?.('imported-') || entry.geometryType === 'merged-cube';

    if (usesCustomGeometry) {
        return {
            mode: 'custom',
            geometry: geometryToData(entry.mesh.geometry)
        };
    }

    if (entry.mesh.userData?.uniqueUvGeometry) {
        return {
            mode: 'uv-only',
            uv: attributeToData(entry.mesh.geometry.getAttribute('uv'))
        };
    }

    return null;
}

function applyUvSnapshotToBlock(entry, uvData) {
    if (!uvData) return;
    entry.mesh.geometry = entry.mesh.geometry.clone();
    entry.mesh.geometry.setAttribute('uv', dataToAttribute(uvData));
    entry.mesh.geometry.computeBoundingBox();
    entry.mesh.geometry.computeBoundingSphere();
    entry.mesh.userData.uniqueUvGeometry = true;
}

function restoreLineGraphs(graphManager, lineEntries) {
    for (const lineEntry of lineEntries) {
        const planes = getEdgePlaneCandidates(lineEntry.start, lineEntry.end);
        for (const plane of planes) {
            graphManager.addEdge(getPlaneKey(plane.axis, plane.value), lineEntry.aKey, lineEntry.bKey);
        }
    }
}

export function createProjectIO({
    scene,
    state,
    ui,
    entryManager,
    blockManager,
    graphManager,
    faceController,
    selectionManager,
    textureManager,
    onUpdate
}) {
    const textureLoader = new THREE.TextureLoader();

    async function buildSnapshot() {
        const lineEntries = entryManager.getLineEntries()
            .filter((entry) => entry.active)
            .map((entry) => ({
                start: vectorToData(entry.start),
                end: vectorToData(entry.end),
                aKey: entry.aKey ?? getVertexKey(entry.start),
                bKey: entry.bKey ?? getVertexKey(entry.end)
            }));

        const planeFaces = await Promise.all(Array.from(state.planeFill.entries()).map(async ([planeKey, planeData]) => ({
            planeKey,
            axis: planeData.axis,
            value: planeData.value,
            cells: Array.from(planeData.cells ?? []),
            mesh: meshToSnapshot(planeData.mesh),
            material: await materialToData(planeData.mesh?.material ?? null)
        })));

        const looseFaces = await Promise.all(Array.from(state.looseFaceMeshes.entries()).map(async ([faceKey, mesh]) => ({
            faceKey,
            faceVertices: Array.from(state.looseFaceVertices.get(faceKey) ?? []),
            mesh: meshToSnapshot(mesh),
            material: await materialToData(mesh.material)
        })));

        const blocks = await Promise.all(blockManager.getBlockEntries()
            .filter((entry) => entry.active)
            .map(async (entry) => ({
                position: vectorToData(entry.position),
                size: entry.size ?? 1,
                dimensions: vectorToData(entry.dimensions ?? new THREE.Vector3(entry.size ?? 1, entry.size ?? 1, entry.size ?? 1)),
                geometryType: entry.geometryType,
                shapeSignature: entry.shapeSignature ?? '',
                vertexMode: entry.vertexMode ?? 'corners',
                surfaceCount: entry.surfaceCount ?? null,
                voxelLocalCells: Array.isArray(entry.voxelLocalCells) ? [...entry.voxelLocalCells] : null,
                preserveMaterialColors: Boolean(entry.preserveMaterialColors),
                material: await materialToData(entry.mesh.material),
                geometryState: serializeBlockGeometryState(entry, state)
            })));

        return {
            version: 1,
            savedAt: new Date().toISOString(),
            app: {
                controlMode: state.controlMode,
                currentGeometryType: state.currentGeometryType,
                currentPosition: vectorToData(state.currentPosition),
                drawingPoints: state.drawingPoints.map(vectorToData),
                pathPoints: state.pathPoints.map(vectorToData)
            },
            textures: textureManager.getProjectTextures(),
            points: serializePointEntries(entryManager),
            lines: lineEntries,
            planeFaces,
            looseFaces,
            blocks
        };
    }

    async function saveProject() {
        try {
            const snapshot = await buildSnapshot();
            await saveTextFile(JSON.stringify(snapshot, null, 2), 'proyecto_simple3d.s3dc');
        } catch (error) {
            console.error('Error al guardar el proyecto:', error);
            alert('No se pudo guardar el proyecto actual.');
        }
    }

    async function restorePlaneFaces(planeFaces = []) {
        for (const planeFace of planeFaces) {
            const geometry = dataToGeometry(planeFace.mesh?.geometry);
            const material = await materialFromData(planeFace.material, textureLoader);
            const mesh = new THREE.Mesh(geometry, material);
            applyMeshTransform(mesh, planeFace.mesh?.transform);
            faceController.restorePlaneFill({
                axis: planeFace.axis,
                value: planeFace.value,
                cells: planeFace.cells,
                mesh
            });
        }
    }

    async function restoreLooseFaces(looseFaces = []) {
        for (const looseFace of looseFaces) {
            const geometry = dataToGeometry(looseFace.mesh?.geometry);
            const material = await materialFromData(looseFace.material, textureLoader);
            const mesh = new THREE.Mesh(geometry, material);
            applyMeshTransform(mesh, looseFace.mesh?.transform);
            faceController.restoreLooseFace({
                faceKey: looseFace.faceKey,
                faceVertices: looseFace.faceVertices,
                mesh
            });
        }
    }

    async function restoreBlocks(blocks = []) {
        for (const block of blocks) {
            const material = await materialFromData(block.material, textureLoader);
            const geometryState = block.geometryState ?? null;
            const geometry = geometryState?.mode === 'custom'
                ? dataToGeometry(geometryState.geometry)
                : null;

            const result = blockManager.registerCustomBlockShape({
                position: dataToVector(block.position),
                size: block.size ?? 1,
                geometryType: block.geometryType,
                dimensions: dataToVector(block.dimensions),
                geometry,
                material,
                shapeSignature: block.shapeSignature ?? '',
                vertexMode: block.vertexMode ?? 'corners',
                surfaceCount: block.surfaceCount ?? null,
                voxelLocalCells: Array.isArray(block.voxelLocalCells) ? [...block.voxelLocalCells] : null,
                preserveMaterialColors: Boolean(block.preserveMaterialColors)
            });

            if (geometryState?.mode === 'uv-only') {
                applyUvSnapshotToBlock(result.entry, geometryState.uv);
            }
        }
    }

    function restoreLines(lines = []) {
        for (const lineData of lines) {
            const start = dataToVector(lineData.start);
            const end = dataToVector(lineData.end);
            const line = createLine(state, start, end);
            const lineEntry = entryManager.registerLineEntry(line, start, end);
            lineEntry.aKey = lineData.aKey ?? getVertexKey(start);
            lineEntry.bKey = lineData.bKey ?? getVertexKey(end);
            state.vertexPositions.set(lineEntry.aKey, start.clone());
            state.vertexPositions.set(lineEntry.bKey, end.clone());
        }

        restoreLineGraphs(graphManager, entryManager.getLineEntries().filter((entry) => entry.active));
    }

    function restorePoints(points = []) {
        for (const pointData of points) {
            if (!pointData?.vertexKey) continue;
            if (entryManager.getPointEntriesByKey(pointData.vertexKey).size > 0) {
                continue;
            }

            const position = dataToVector(pointData.position);
            state.vertexPositions.set(pointData.vertexKey, position.clone());
            const point = createPointMarker(state, position);
            entryManager.registerPointEntry(point, position, pointData.vertexKey, pointData.source ?? 'line');
        }
    }

    async function loadProject(file) {
        if (!file) return false;

        try {
            const snapshot = JSON.parse(await file.text());
            if (!snapshot || typeof snapshot !== 'object') {
                throw new Error('Formato de proyecto invalido.');
            }

            clearCurrentModel({
                scene,
                state,
                entryManager,
                blockManager,
                selectionManager
            });

            await textureManager.importProjectTextures(snapshot.textures ?? []);
            restoreLines(snapshot.lines ?? []);
            await restorePlaneFaces(snapshot.planeFaces ?? []);
            await restoreLooseFaces(snapshot.looseFaces ?? []);
            await restoreBlocks(snapshot.blocks ?? []);
            restorePoints(snapshot.points ?? []);

            state.controlMode = normalizeControlMode(snapshot.app?.controlMode ?? state.controlMode);
            state.currentGeometryType = snapshot.app?.currentGeometryType ?? state.currentGeometryType;
            state.currentPosition.copy(dataToVector(snapshot.app?.currentPosition ?? { x: 0, y: 0, z: 0 }));
            state.cursorMesh.position.copy(state.currentPosition);
            state.drawingPoints = (snapshot.app?.drawingPoints ?? [vectorToData(state.currentPosition)]).map(dataToVector);
            state.pathPoints = (snapshot.app?.pathPoints ?? [vectorToData(state.currentPosition)]).map(dataToVector);

            ui.setControlMode(state.controlMode);
            ui.setGeometry(state.currentGeometryType);
            selectionManager?.clearSelection?.();
            onUpdate?.();
            return true;
        } catch (error) {
            console.error('Error al cargar el proyecto:', error);
            alert(`No se pudo cargar el proyecto ${file.name}.`);
            return false;
        }
    }

    return {
        saveProject,
        loadProject
    };
}
