import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { getVertexKey } from './geometry.js';

function cloneMaterial(material) {
    if (Array.isArray(material)) {
        return material.map((item) => item.clone());
    }
    return material?.clone?.() ?? new THREE.MeshStandardMaterial({ color: 0xbcbcbc });
}

function prepareGeometry(geometry) {
    const prepared = geometry.clone();
    prepared.computeBoundingBox();
    if (!prepared.getAttribute('normal')) {
        prepared.computeVertexNormals();
    }
    prepared.computeBoundingSphere();
    return prepared;
}

function collectMeshDescriptors(root) {
    const meshes = [];
    root.updateMatrixWorld(true);

    root.traverse((child) => {
        if (!child.isMesh || !child.geometry) return;

        const geometry = prepareGeometry(child.geometry);
        geometry.applyMatrix4(child.matrixWorld);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        const bounds = geometry.boundingBox?.clone() ?? new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position'));
        const center = bounds.getCenter(new THREE.Vector3());
        const dimensions = bounds.getSize(new THREE.Vector3());

        if (dimensions.lengthSq() <= 1e-12) {
            return;
        }

        geometry.translate(-center.x, -center.y, -center.z);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();

        meshes.push({
            geometry,
            material: cloneMaterial(child.material),
            position: center,
            dimensions
        });
    });

    return meshes;
}

async function parseModelFile(file, format) {
    if (format === 'fbx') {
        const buffer = await file.arrayBuffer();
        const loader = new FBXLoader();
        return loader.parse(buffer, '');
    }

    const text = await file.text();
    const loader = new OBJLoader();
    return loader.parse(text);
}

export function clearCurrentModel({
    scene,
    state,
    entryManager,
    blockManager,
    selectionManager
}) {
    selectionManager?.clearSelection?.();

    for (const lineEntry of entryManager.getLineEntries()) {
        lineEntry.active = false;
        entryManager.refreshEntryVisibility(lineEntry);
    }

    for (const pointEntry of entryManager.getPointEntries()) {
        pointEntry.active = false;
        pointEntry.hovered = false;
        pointEntry.selected = false;
        pointEntry.multiSelected = false;
        entryManager.refreshEntryVisibility(pointEntry);
    }

    for (const blockEntry of blockManager.getBlockEntries()) {
        blockEntry.active = false;
        blockEntry.hovered = false;
        blockEntry.selected = false;
        blockManager.refreshEntryVisibility(blockEntry);
        if (blockEntry.geometryType?.startsWith?.('imported-')) {
            blockEntry.mesh.geometry?.dispose?.();
            if (Array.isArray(blockEntry.mesh.material)) {
                blockEntry.mesh.material.forEach((material) => material?.dispose?.());
            } else {
                blockEntry.mesh.material?.dispose?.();
            }
            blockEntry.outline?.geometry?.dispose?.();
            blockEntry.outline?.material?.dispose?.();
        }
    }
    blockManager.clearSelection();

    for (const planeData of state.planeFill.values()) {
        if (planeData.mesh) {
            scene.remove(planeData.mesh);
        }
        if (planeData.gridLines) {
            scene.remove(planeData.gridLines);
        }
    }

    for (const mesh of state.looseFaceMeshes.values()) {
        scene.remove(mesh);
        mesh.geometry?.dispose?.();
        if (Array.isArray(mesh.material)) {
            mesh.material.forEach((material) => material?.dispose?.());
        } else {
            mesh.material?.dispose?.();
        }
    }

    state.planeGraphs.clear();
    state.faceRegistry.clear();
    state.vertexPositions.clear();
    state.planeFill.clear();
    state.looseFaceVertices.clear();
    state.looseFaceMeshes.clear();
    state.selectedEntry = null;
    state.selectedPointKeys = [];
    state.hoveredEntry = null;
    state.selectedFace = null;
    state.hoveredFace = null;
    state.selectedBlock = null;
    state.selectedBlocks = [];
    state.hoveredBlock = null;
    state.undoStack = [];
    state.redoStack = [];
    state.currentPosition.set(0, 0, 0);
    state.cursorMesh.position.copy(state.currentPosition);
    state.drawingPoints = [state.currentPosition.clone()];
    state.pathPoints = [state.currentPosition.clone()];

    const originKey = getVertexKey(state.currentPosition);
    state.originPoint.position.copy(state.currentPosition);
    const originEntry = entryManager.getEntryByMesh(state.originPoint);
    if (originEntry) {
        originEntry.active = true;
        originEntry.position.copy(state.currentPosition);
        originEntry.mesh.position.copy(state.currentPosition);
        originEntry.vertexKey = originKey;
        entryManager.refreshEntryVisibility(originEntry);
    }
    state.vertexPositions.set(originKey, state.currentPosition.clone());
}

export function createModelImporter({
    scene,
    state,
    entryManager,
    blockManager,
    selectionManager,
    onUpdate
}) {
    async function importModel({ file, format }) {
        const normalizedFormat = format === 'fbx' ? 'fbx' : 'obj';

        try {
            const parsed = await parseModelFile(file, normalizedFormat);
            const descriptors = collectMeshDescriptors(parsed);

            if (descriptors.length === 0) {
                alert('No se encontraron mallas importables dentro del archivo seleccionado.');
                return false;
            }

            clearCurrentModel({
                scene,
                state,
                entryManager,
                blockManager,
                selectionManager
            });

            const importSeed = `${normalizedFormat}:${Date.now()}`;
            descriptors.forEach((descriptor, index) => {
                blockManager.registerCustomBlockShape({
                    position: descriptor.position,
                    size: 1,
                    geometryType: `imported-${normalizedFormat}`,
                    dimensions: descriptor.dimensions,
                    geometry: descriptor.geometry,
                    material: descriptor.material,
                    shapeSignature: `${importSeed}:${index}`,
                    vertexMode: 'none',
                    preserveMaterialColors: true
                });
            });

            onUpdate?.();
            alert(`Modelo cargado: ${descriptors.length} pieza(s) importada(s) desde ${file.name}.`);
            return true;
        } catch (error) {
            console.error(`Error al importar ${normalizedFormat.toUpperCase()}:`, error);
            alert(`No se pudo cargar el archivo ${file.name}. Revisa que sea un ${normalizedFormat.toUpperCase()} valido.`);
            return false;
        }
    }

    return {
        importModel
    };
}
