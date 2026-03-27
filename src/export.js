import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const EXPORT_VERTEX_TOLERANCE = 1e-6;
const BLOCK_EPSILON = 1e-4;

function cloneMaterialForExport(material, fallback = null) {
    if (Array.isArray(material)) {
        return material.map((item) => cloneMaterialForExport(item));
    }

    const source = fallback ?? material;
    if (!source) return null;

    const cloned = source.clone();
    if (cloned.emissive) {
        cloned.emissive.setHex(0x000000);
    }
    return cloned;
}

function materialUsesTextureMap(material) {
    if (Array.isArray(material)) {
        return material.some((item) => materialUsesTextureMap(item));
    }
    return Boolean(material?.map);
}

function optimizeGeometryForExport(geometry, { dropUv = false } = {}) {
    if (!geometry?.getAttribute?.('position')) {
        return geometry?.clone?.() ?? geometry;
    }

    const cloned = geometry.clone();
    if (dropUv && cloned.getAttribute('uv')) {
        cloned.deleteAttribute('uv');
    }
    const optimized = mergeVertices(cloned, EXPORT_VERTEX_TOLERANCE);
    if (!optimized.getAttribute('normal')) {
        optimized.computeVertexNormals();
    }
    optimized.computeBoundingBox();
    optimized.computeBoundingSphere();
    return optimized;
}

function cloneMeshWithoutLines(mesh, { materialOverride = null } = {}) {
    const cloned = mesh.clone();
    const removableChildren = [];
    cloned.traverse((child) => {
        if (child !== cloned && (child.isLine || child.isLineSegments)) {
            removableChildren.push(child);
        }
    });
    for (const child of removableChildren) {
        child.parent?.remove(child);
    }
    const exportMaterial = materialOverride
        ? cloneMaterialForExport(null, materialOverride)
        : cloneMaterialForExport(cloned.material);
    if (cloned.geometry) {
        cloned.geometry = optimizeGeometryForExport(cloned.geometry, {
            dropUv: !materialUsesTextureMap(exportMaterial)
        });
    }
    cloned.material = exportMaterial;
    return cloned;
}

function formatBlockNumber(value) {
    const normalized = Math.abs(value) < EXPORT_VERTEX_TOLERANCE ? 0 : value;
    return normalized.toFixed(6);
}

function getGridIndex(value, origin, size, tolerance = BLOCK_EPSILON) {
    const rawIndex = (value - origin) / size;
    const roundedIndex = Math.round(rawIndex);
    if (Math.abs(rawIndex - roundedIndex) > tolerance) {
        return null;
    }
    return roundedIndex;
}

function getCellKey(x, y, z) {
    return `${x},${y},${z}`;
}

function parseCellKey(key) {
    const [x, y, z] = key.split(',').map(Number);
    return { x, y, z };
}

function getEntryDimensions(entry) {
    if (entry?.dimensions?.isVector3) {
        return entry.dimensions.clone();
    }
    const size = entry?.size ?? 1;
    return new THREE.Vector3(size, size, size);
}

function getBlockMinCorner(entry) {
    const dimensions = getEntryDimensions(entry);
    return entry.position.clone().sub(dimensions.multiplyScalar(0.5));
}

function positiveModulo(value, step) {
    const result = value % step;
    return result < 0 ? result + step : result;
}

function normalizeGridOffset(value, size) {
    const normalized = positiveModulo(value, size);
    if (normalized <= BLOCK_EPSILON || Math.abs(normalized - size) <= BLOCK_EPSILON) {
        return 0;
    }
    return normalized;
}

function getEntryGridOffset(entry) {
    const size = entry?.size ?? 1;
    const minCorner = getBlockMinCorner(entry);
    return new THREE.Vector3(
        normalizeGridOffset(minCorner.x, size),
        normalizeGridOffset(minCorner.y, size),
        normalizeGridOffset(minCorner.z, size)
    );
}

function getCellSpan(length, size) {
    const rawSpan = length / size;
    const roundedSpan = Math.round(rawSpan);
    if (roundedSpan <= 0 || Math.abs(rawSpan - roundedSpan) > BLOCK_EPSILON) {
        return null;
    }
    return roundedSpan;
}

function getEntryCellBounds(entry, offset) {
    const size = entry?.size ?? 1;
    const dimensions = getEntryDimensions(entry);
    const minCorner = getBlockMinCorner(entry);
    const spans = {
        x: getCellSpan(dimensions.x, size),
        y: getCellSpan(dimensions.y, size),
        z: getCellSpan(dimensions.z, size)
    };

    if (!spans.x || !spans.y || !spans.z) {
        return null;
    }

    const start = {
        x: getGridIndex(minCorner.x, offset.x, size),
        y: getGridIndex(minCorner.y, offset.y, size),
        z: getGridIndex(minCorner.z, offset.z, size)
    };

    if (start.x === null || start.y === null || start.z === null) {
        return null;
    }

    return { start, spans };
}

function canMergeVoxelEntry(entry) {
    return (
        entry?.active &&
        !Array.isArray(entry.mesh?.material) &&
        !entry.mesh?.material?.map &&
        (
            (entry.geometryType === 'merged-cube' && Array.isArray(entry.voxelLocalCells) && entry.voxelLocalCells.length > 0)
            || (entry.geometryType === 'cube' && getEntryCellBounds(entry, getEntryGridOffset(entry)) !== null)
        )
    );
}

function getVoxelGroupKey(entry) {
    const offset = getEntryGridOffset(entry);
    return [
        formatBlockNumber(entry.size ?? 1),
        formatBlockNumber(offset.x),
        formatBlockNumber(offset.y),
        formatBlockNumber(offset.z)
    ].join('|');
}

function appendEntryOccupiedCells(entry, offset, occupied) {
    const bounds = getEntryCellBounds(entry, offset);
    if (!bounds) {
        return false;
    }

    if (entry.geometryType === 'merged-cube' && Array.isArray(entry.voxelLocalCells)) {
        for (const localKey of entry.voxelLocalCells) {
            const localCell = parseCellKey(localKey);
            occupied.add(getCellKey(
                bounds.start.x + localCell.x,
                bounds.start.y + localCell.y,
                bounds.start.z + localCell.z
            ));
        }
        return true;
    }

    for (let y = bounds.start.y; y < bounds.start.y + bounds.spans.y; y += 1) {
        for (let z = bounds.start.z; z < bounds.start.z + bounds.spans.z; z += 1) {
            for (let x = bounds.start.x; x < bounds.start.x + bounds.spans.x; x += 1) {
                occupied.add(getCellKey(x, y, z));
            }
        }
    }

    return true;
}

function mergePlaneCells(cells) {
    const ordered = Array.from(cells).sort((a, b) => a.v - b.v || a.u - b.u);
    const used = new Set();
    const rects = [];

    for (const cell of ordered) {
        const startKey = getCellKey(cell.u, cell.v, 0);
        if (used.has(startKey)) continue;

        let width = 1;
        while (cells.some((candidate) => candidate.u === cell.u + width && candidate.v === cell.v) && !used.has(getCellKey(cell.u + width, cell.v, 0))) {
            width += 1;
        }

        let height = 1;
        heightLoop: while (true) {
            const nextV = cell.v + height;
            for (let du = 0; du < width; du += 1) {
                const nextKey = getCellKey(cell.u + du, nextV, 0);
                if (!cells.some((candidate) => candidate.u === cell.u + du && candidate.v === nextV) || used.has(nextKey)) {
                    break heightLoop;
                }
            }
            height += 1;
        }

        for (let dv = 0; dv < height; dv += 1) {
            for (let du = 0; du < width; du += 1) {
                used.add(getCellKey(cell.u + du, cell.v + dv, 0));
            }
        }

        rects.push({
            u: cell.u,
            v: cell.v,
            width,
            height
        });
    }

    return rects;
}

function pushQuad(positions, normals, uvs, vertices, normal) {
    const triangleOrder = [0, 1, 2, 0, 2, 3];
    const quadUvs = [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1]
    ];

    for (const index of triangleOrder) {
        const vertex = vertices[index];
        positions.push(vertex.x, vertex.y, vertex.z);
        normals.push(normal.x, normal.y, normal.z);
        if (uvs) {
            const uv = quadUvs[index];
            uvs.push(uv[0], uv[1]);
        }
    }
}

function createMergedCubeMeshFromOccupied(occupied, origin, size, material) {
    if (!occupied || occupied.size === 0) {
        return null;
    }

    const planeFaces = new Map();

    function hasCell(x, y, z) {
        return occupied.has(getCellKey(x, y, z));
    }

    function addFace(axis, direction, plane, u, v) {
        const key = `${axis}:${direction}:${plane}`;
        if (!planeFaces.has(key)) {
            planeFaces.set(key, []);
        }
        planeFaces.get(key).push({ u, v });
    }

    for (const key of occupied) {
        const cell = parseCellKey(key);
        if (!hasCell(cell.x - 1, cell.y, cell.z)) addFace('x', -1, cell.x, cell.y, cell.z);
        if (!hasCell(cell.x + 1, cell.y, cell.z)) addFace('x', 1, cell.x + 1, cell.y, cell.z);
        if (!hasCell(cell.x, cell.y - 1, cell.z)) addFace('y', -1, cell.y, cell.x, cell.z);
        if (!hasCell(cell.x, cell.y + 1, cell.z)) addFace('y', 1, cell.y + 1, cell.x, cell.z);
        if (!hasCell(cell.x, cell.y, cell.z - 1)) addFace('z', -1, cell.z, cell.x, cell.y);
        if (!hasCell(cell.x, cell.y, cell.z + 1)) addFace('z', 1, cell.z + 1, cell.x, cell.y);
    }

    const positions = [];
    const normals = [];

    for (const [planeKey, cells] of planeFaces.entries()) {
        const [axis, directionText, planeText] = planeKey.split(':');
        const direction = Number(directionText);
        const plane = Number(planeText);
        const rects = mergePlaneCells(cells);

        for (const rect of rects) {
            if (axis === 'x' && direction > 0) {
                const u0 = origin.y + rect.u * size;
                const u1 = origin.y + (rect.u + rect.width) * size;
                const v0 = origin.z + rect.v * size;
                const v1 = origin.z + (rect.v + rect.height) * size;
                const p = origin.x + plane * size;
                pushQuad(
                    positions,
                    normals,
                    null,
                    [
                        new THREE.Vector3(p, u0, v0),
                        new THREE.Vector3(p, u1, v0),
                        new THREE.Vector3(p, u1, v1),
                        new THREE.Vector3(p, u0, v1)
                    ],
                    new THREE.Vector3(1, 0, 0)
                );
                continue;
            }

            if (axis === 'x') {
                const u0 = origin.y + rect.u * size;
                const u1 = origin.y + (rect.u + rect.width) * size;
                const v0 = origin.z + rect.v * size;
                const v1 = origin.z + (rect.v + rect.height) * size;
                const p = origin.x + plane * size;
                pushQuad(
                    positions,
                    normals,
                    null,
                    [
                        new THREE.Vector3(p, u0, v0),
                        new THREE.Vector3(p, u0, v1),
                        new THREE.Vector3(p, u1, v1),
                        new THREE.Vector3(p, u1, v0)
                    ],
                    new THREE.Vector3(-1, 0, 0)
                );
                continue;
            }

            if (axis === 'y' && direction > 0) {
                const u0 = origin.x + rect.u * size;
                const u1 = origin.x + (rect.u + rect.width) * size;
                const v0 = origin.z + rect.v * size;
                const v1 = origin.z + (rect.v + rect.height) * size;
                const p = origin.y + plane * size;
                pushQuad(
                    positions,
                    normals,
                    null,
                    [
                        new THREE.Vector3(u0, p, v0),
                        new THREE.Vector3(u0, p, v1),
                        new THREE.Vector3(u1, p, v1),
                        new THREE.Vector3(u1, p, v0)
                    ],
                    new THREE.Vector3(0, 1, 0)
                );
                continue;
            }

            if (axis === 'y') {
                const u0 = origin.x + rect.u * size;
                const u1 = origin.x + (rect.u + rect.width) * size;
                const v0 = origin.z + rect.v * size;
                const v1 = origin.z + (rect.v + rect.height) * size;
                const p = origin.y + plane * size;
                pushQuad(
                    positions,
                    normals,
                    null,
                    [
                        new THREE.Vector3(u0, p, v0),
                        new THREE.Vector3(u1, p, v0),
                        new THREE.Vector3(u1, p, v1),
                        new THREE.Vector3(u0, p, v1)
                    ],
                    new THREE.Vector3(0, -1, 0)
                );
                continue;
            }

            if (axis === 'z' && direction > 0) {
                const u0 = origin.x + rect.u * size;
                const u1 = origin.x + (rect.u + rect.width) * size;
                const v0 = origin.y + rect.v * size;
                const v1 = origin.y + (rect.v + rect.height) * size;
                const p = origin.z + plane * size;
                pushQuad(
                    positions,
                    normals,
                    null,
                    [
                        new THREE.Vector3(u0, v0, p),
                        new THREE.Vector3(u1, v0, p),
                        new THREE.Vector3(u1, v1, p),
                        new THREE.Vector3(u0, v1, p)
                    ],
                    new THREE.Vector3(0, 0, 1)
                );
                continue;
            }

            const u0 = origin.x + rect.u * size;
            const u1 = origin.x + (rect.u + rect.width) * size;
            const v0 = origin.y + rect.v * size;
            const v1 = origin.y + (rect.v + rect.height) * size;
            const p = origin.z + plane * size;
            pushQuad(
                positions,
                normals,
                null,
                [
                    new THREE.Vector3(u0, v0, p),
                    new THREE.Vector3(u0, v1, p),
                    new THREE.Vector3(u1, v1, p),
                    new THREE.Vector3(u1, v0, p)
                ],
                new THREE.Vector3(0, 0, -1)
            );
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    const optimizedGeometry = mergeVertices(geometry, EXPORT_VERTEX_TOLERANCE);
    optimizedGeometry.computeBoundingBox();
    optimizedGeometry.computeBoundingSphere();

    return new THREE.Mesh(optimizedGeometry, cloneMaterialForExport(null, material));
}

function collectExportBlockMeshes(blockManager, state) {
    if (!blockManager) return [];

    const exportMeshes = [];
    const mergeGroups = new Map();
    const activeBlocks = blockManager.getBlockEntries().filter((entry) => entry.active);

    for (const entry of activeBlocks) {
        if (!canMergeVoxelEntry(entry)) {
            const materialOverride = !Array.isArray(entry.mesh?.material) && !entry.mesh?.material?.map
                ? state.blockMaterial
                : null;
            exportMeshes.push(cloneMeshWithoutLines(entry.mesh, { materialOverride }));
            continue;
        }

        const groupKey = getVoxelGroupKey(entry);
        if (!mergeGroups.has(groupKey)) {
            mergeGroups.set(groupKey, {
                size: entry.size ?? 1,
                origin: getEntryGridOffset(entry),
                entries: [],
                material: state.blockMaterial
            });
        }
        mergeGroups.get(groupKey).entries.push(entry);
    }

    for (const group of mergeGroups.values()) {
        const occupied = new Set();
        let validGroup = true;

        for (const entry of group.entries) {
            if (appendEntryOccupiedCells(entry, group.origin, occupied)) continue;
            validGroup = false;
            break;
        }

        const mergedMesh = validGroup
            ? createMergedCubeMeshFromOccupied(occupied, group.origin, group.size, group.material)
            : null;
        if (mergedMesh) {
            exportMeshes.push(mergedMesh);
            continue;
        }

        for (const entry of group.entries) {
            exportMeshes.push(cloneMeshWithoutLines(entry.mesh, { materialOverride: state.blockMaterial }));
        }
    }

    return exportMeshes;
}

function saveString(text, filename) {
    save(new Blob([text], { type: 'text/plain' }), filename);
}

function saveArrayBuffer(buffer, filename) {
    save(new Blob([buffer], { type: 'application/octet-stream' }), filename);
}

function save(blob, filename) {
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

function createExportGroup(state, blockManager) {
    const exportGroup = new THREE.Group();

    for (const planeData of state.planeFill.values()) {
        if (!planeData?.mesh) continue;
        exportGroup.add(cloneMeshWithoutLines(planeData.mesh));
    }

    // Export user-created loose faces
    for (const [faceKey, mesh] of state.looseFaceMeshes.entries()) {
        const clonedFace = cloneMeshWithoutLines(mesh);
        exportGroup.add(clonedFace);
    }

    for (const blockMesh of collectExportBlockMeshes(blockManager, state)) {
        exportGroup.add(blockMesh);
    }

    exportGroup.updateMatrixWorld(true);
    return exportGroup;
}

export function exportGLTF(state, blockManager) {
    const exportGroup = createExportGroup(state, blockManager);
    if (exportGroup.children.length === 0) {
        alert("El modelo está vacío.");
        return;
    }

    const exporter = new GLTFExporter();
    exporter.parse(
        exportGroup,
        function (gltf) {
            saveArrayBuffer(gltf, 'modelo_3d.glb');
        },
        function (error) {
            console.error('Error al exportar a GLTF/GLB:', error);
            alert("Hubo un error al exportar el modelo.");
        },
        { binary: true }
    );
}

export async function exportOBJ(state, blockManager) {
    const exportGroup = createExportGroup(state, blockManager);
    if (exportGroup.children.length === 0) {
        alert("El modelo está vacío.");
        return;
    }

    const exporter = new OBJExporter();
    let objData = exporter.parse(exportGroup);

    // Extract materials and textures
    const materials = new Map();
    const textures = new Map();
    let materialIndex = 0;

    exportGroup.traverse((child) => {
        if (!child.isMesh || !child.material) return;

        const meshMaterials = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of meshMaterials) {
            if (!mat) continue;
            if (!mat.name || (materials.has(mat.name) && materials.get(mat.name) !== mat)) {
                mat.name = 'Material_' + (++materialIndex);
            }
            if (!materials.has(mat.name)) {
                materials.set(mat.name, mat);
            }
            if (mat.map && mat.map.image && !textures.has(mat.name)) {
                textures.set(mat.name, mat.map.image);
            }
        }
    });

    // Re-parse the OBJ to include material names (set lazily above)
    objData = exporter.parse(exportGroup);
    
    // Inject mtllib declaration into the OBJ string
    objData = "mtllib modelo.mtl\n" + objData;

    let mtlData = "";
    const zip = new JSZip();

    // Process textures and build MTL
    for (const [matName, mat] of materials.entries()) {
        mtlData += `newmtl ${matName}\n`;
        const c = mat.color;
        mtlData += `Kd ${c.r.toFixed(4)} ${c.g.toFixed(4)} ${c.b.toFixed(4)}\n`;
        mtlData += `Ns ${(mat.roughness !== undefined ? (1 - mat.roughness) * 100 : 50).toFixed(4)}\n`;
        mtlData += `d ${mat.opacity !== undefined ? mat.opacity : 1.0}\n`;

        if (textures.has(matName)) {
            const img = textures.get(matName);
            const fileName = `texture_${matName}.png`;
            mtlData += `map_Kd ${fileName}\n`;

            try {
                // Draw image to internal canvas to get a Blob buffer
                const canvas = document.createElement('canvas');
                canvas.width = img.width || img.naturalWidth || 512;
                canvas.height = img.height || img.naturalHeight || 512;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                if (blob) {
                    zip.file(fileName, blob);
                }
            } catch (e) {
                console.warn("No se pudo extraer la textura para", matName, e);
            }
        }
        mtlData += "\n";
    }

    // Add OBJ, MTL
    zip.file("modelo.obj", objData);
    zip.file("modelo.mtl", mtlData);

    try {
        const zipBlob = await zip.generateAsync({ type: "blob" });
        save(zipBlob, 'modelo_3d.zip');
    } catch (e) {
        console.error("Error al generar el ZIP", e);
        alert("Ocurrió un error al generar el archivo ZIP.");
    }
}
