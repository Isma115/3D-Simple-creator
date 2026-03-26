import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';

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

    // Export user-created loose faces
    for (const [faceKey, mesh] of state.looseFaceMeshes.entries()) {
        const clonedFace = mesh.clone();
        // Remove grid lines and purely internal features if any
        clonedFace.children = clonedFace.children.filter(child => child.type !== 'Line');
        exportGroup.add(clonedFace);
    }

    // Export active blocks
    if (blockManager) {
        const activeBlocks = blockManager.getBlockEntries().filter(entry => entry.active);
        for (const block of activeBlocks) {
            const clonedBlock = block.mesh.clone();
            exportGroup.add(clonedBlock);
        }
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
        save(zipBlob, 'modelo_3d.zip');
    } catch (e) {
        console.error("Error al generar el ZIP", e);
        alert("Ocurrió un error al generar el archivo ZIP.");
    }
}
