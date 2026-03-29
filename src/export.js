import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

function cloneMeshWithoutLines(mesh) {
    const cloned = mesh.clone();
    const removableChildren = cloned.children.filter((child) => child.isLine || child.isLineSegments);
    for (const child of removableChildren) {
        cloned.remove(child);
    }
    return cloned;
}

function getGroupOrigin(entries, size) {
    const half = size / 2;
    const origin = new THREE.Vector3(Infinity, Infinity, Infinity);

    for (const entry of entries) {
        origin.x = Math.min(origin.x, entry.position.x - half);
        origin.y = Math.min(origin.y, entry.position.y - half);
        origin.z = Math.min(origin.z, entry.position.z - half);
    }

    return origin;
}

function getGridIndex(value, origin, size, tolerance = 1e-5) {
    const rawIndex = (value - origin) / size;
    const roundedIndex = Math.round(rawIndex);
    if (Math.abs(rawIndex - roundedIndex) > tolerance) {
        return null;
    }
    return roundedIndex;
}

function getCubeCell(entry, origin, size) {
    const half = size / 2;
    const x = getGridIndex(entry.position.x - half, origin.x, size);
    const y = getGridIndex(entry.position.y - half, origin.y, size);
    const z = getGridIndex(entry.position.z - half, origin.z, size);

    if (x === null || y === null || z === null) {
        return null;
    }

    return { x, y, z };
}

function getCellKey(x, y, z) {
    return `${x},${y},${z}`;
}

function getEntryDimensions(entry) {
    if (entry?.dimensions?.isVector3) {
        return entry.dimensions;
    }
    const size = entry?.size ?? 1;
    return new THREE.Vector3(size, size, size);
}

function isSingleCellCubeEntry(entry) {
    const dimensions = getEntryDimensions(entry);
    const size = entry?.size ?? 1;
    return (
        Math.abs(dimensions.x - size) <= 1e-6 &&
        Math.abs(dimensions.y - size) <= 1e-6 &&
        Math.abs(dimensions.z - size) <= 1e-6
    );
}

function canMergeCubeEntry(entry) {
    return (
        entry.geometryType === 'cube' &&
        isSingleCellCubeEntry(entry) &&
        !Array.isArray(entry.mesh?.material) &&
        !entry.mesh?.material?.map
    );
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
        const uv = quadUvs[index];
        uvs.push(uv[0], uv[1]);
    }
}

function createMergedCubeMesh(entries, material) {
    const size = entries[0]?.size ?? 1;
    const origin = getGroupOrigin(entries, size);
    const occupied = new Set();
    const planeFaces = new Map();

    for (const entry of entries) {
        const cell = getCubeCell(entry, origin, size);
        if (!cell) {
            return null;
        }
        occupied.add(getCellKey(cell.x, cell.y, cell.z));
    }

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

    for (const entry of entries) {
        const cell = getCubeCell(entry, origin, size);
        if (!cell) {
            return null;
        }
        if (!hasCell(cell.x - 1, cell.y, cell.z)) addFace('x', -1, cell.x, cell.y, cell.z);
        if (!hasCell(cell.x + 1, cell.y, cell.z)) addFace('x', 1, cell.x + 1, cell.y, cell.z);
        if (!hasCell(cell.x, cell.y - 1, cell.z)) addFace('y', -1, cell.y, cell.x, cell.z);
        if (!hasCell(cell.x, cell.y + 1, cell.z)) addFace('y', 1, cell.y + 1, cell.x, cell.z);
        if (!hasCell(cell.x, cell.y, cell.z - 1)) addFace('z', -1, cell.z, cell.x, cell.y);
        if (!hasCell(cell.x, cell.y, cell.z + 1)) addFace('z', 1, cell.z + 1, cell.x, cell.y);
    }

    const positions = [];
    const normals = [];
    const uvs = [];

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
                    uvs,
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
                    uvs,
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
                    uvs,
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
                    uvs,
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
                    uvs,
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
                uvs,
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
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    const optimizedGeometry = mergeVertices(geometry, 1e-6);
    optimizedGeometry.computeBoundingBox();
    optimizedGeometry.computeBoundingSphere();

    return new THREE.Mesh(optimizedGeometry, material.clone());
}

function collectExportBlockMeshes(blockManager, state) {
    if (!blockManager) return [];

    const exportMeshes = [];
    const mergeGroups = new Map();
    const activeBlocks = blockManager.getBlockEntries().filter((entry) => entry.active);

    for (const entry of activeBlocks) {
        if (!canMergeCubeEntry(entry)) {
            exportMeshes.push(cloneMeshWithoutLines(entry.mesh));
            continue;
        }

        const groupKey = `${entry.size}|cube`;
        if (!mergeGroups.has(groupKey)) {
            mergeGroups.set(groupKey, {
                entries: [],
                material: state.blockMaterial
            });
        }
        mergeGroups.get(groupKey).entries.push(entry);
    }

    for (const group of mergeGroups.values()) {
        const mergedMesh = createMergedCubeMesh(group.entries, group.material);
        if (mergedMesh) {
            exportMeshes.push(mergedMesh);
            continue;
        }

        for (const entry of group.entries) {
            exportMeshes.push(cloneMeshWithoutLines(entry.mesh));
        }
    }

    return exportMeshes;
}

function saveString(text, filename) {
    return save(new Blob([text], { type: 'text/plain' }), filename, 'Texto (*.txt)');
}

function saveArrayBuffer(buffer, filename) {
    const extension = filename.split('.').pop()?.toLowerCase() ?? '*';
    return save(new Blob([buffer], { type: 'application/octet-stream' }), filename, `Archivo (${extension === '*' ? '*.*' : `*.${extension}`})`);
}

function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo a exportar.'));
        reader.readAsDataURL(blob);
    });
}

async function save(blob, filename, fileType = 'Archivos (*.*)') {
    if (window.pywebview?.api?.save_export_file) {
        const dataUrl = await blobToDataUrl(blob);
        const result = await window.pywebview.api.save_export_file(dataUrl, filename, fileType);
        if (result?.saved || result?.cancelled) {
            return;
        }
        throw new Error(result?.error ?? 'No se pudo guardar el archivo exportado.');
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

function createExportGroup(state, blockManager) {
    const exportGroup = new THREE.Group();

    // Export user-created loose faces
    for (const [faceKey, mesh] of state.looseFaceMeshes.entries()) {
        const clonedFace = cloneMeshWithoutLines(mesh);
        exportGroup.add(clonedFace);
    }

    for (const blockMesh of collectExportBlockMeshes(blockManager, state)) {
        exportGroup.add(blockMesh);
    }

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
            saveArrayBuffer(gltf, 'modelo_3d.glb').catch((error) => {
                console.error('Error al guardar el GLB:', error);
                alert("Hubo un error al guardar el modelo.");
            });
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
        if (child.isMesh && child.material) {
            const mat = child.material;
            // Give material a name if it lacks one
            if (!mat.name) {
                mat.name = 'Material_' + (++materialIndex);
            }
            if (!materials.has(mat.name)) {
                materials.set(mat.name, mat);
            }
            if (mat.map && mat.map.image) {
                if (!textures.has(mat.name)) {
                    textures.set(mat.name, mat.map.image);
                }
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
        await save(zipBlob, 'modelo_3d.zip', 'ZIP (*.zip)');
    } catch (e) {
        console.error("Error al generar el ZIP", e);
        alert("Ocurrió un error al generar el archivo ZIP.");
    }
}
