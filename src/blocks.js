import * as THREE from 'three';
import { COLORS } from './constants.js';
import { getVertexKey, roundCoord } from './geometry.js';

export function createBlockManager({ scene, state, entryManager }) {
    const blockEntries = [];
    const blockEntriesByKey = new Map();
    const meshToBlockEntry = new WeakMap();
    const blockVertexRefs = new Map();

    const BASE_COLOR = COLORS.face;
    const ACTIVE_COLOR = COLORS.line;
    const ACTIVE_EMISSIVE = 0x331100;
    const OUTLINE_COLOR = 0xffffff;

    function addEntryToScene(entry) {
        if (!entry.inScene) {
            scene.add(entry.mesh);
            entry.inScene = true;
        }
    }

    function removeEntryFromScene(entry) {
        if (entry.inScene) {
            scene.remove(entry.mesh);
            entry.inScene = false;
        }
    }

    function createPointMarker(position) {
        const point = new THREE.Mesh(state.pointGeometry, state.pointMaterial.clone());
        point.position.copy(position);
        point.renderOrder = 2;
        return point;
    }

    function createBlockOutline(geometry) {
        const edges = new THREE.EdgesGeometry(geometry);
        const outline = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({
                color: OUTLINE_COLOR,
                transparent: true,
                opacity: 0.92,
                depthWrite: false
            })
        );
        outline.renderOrder = 3;
        outline.scale.setScalar(1.001);
        return outline;
    }

    function getBlockCorners(entry) {
        const size = entry.size ?? 1;
        const half = size / 2;
        const offsets = [-half, half];
        const corners = [];
        for (const ox of offsets) {
            for (const oy of offsets) {
                for (const oz of offsets) {
                    corners.push(new THREE.Vector3(
                        entry.position.x + ox,
                        entry.position.y + oy,
                        entry.position.z + oz
                    ));
                }
            }
        }
        return corners;
    }

    function addBlockVertices(entry) {
        if (!entryManager) return;
        const corners = getBlockCorners(entry);
        for (const corner of corners) {
            const key = getVertexKey(corner);
            const count = blockVertexRefs.get(key) ?? 0;
            blockVertexRefs.set(key, count + 1);
            if (count === 0) {
                const pointMesh = createPointMarker(corner);
                entryManager.registerPointEntry(pointMesh, corner, key, 'block');
                if (!state.vertexPositions.has(key)) {
                    state.vertexPositions.set(key, corner.clone());
                }
            }
        }
    }

    function removeBlockVertices(entry) {
        if (!entryManager) return;
        const corners = getBlockCorners(entry);
        for (const corner of corners) {
            const key = getVertexKey(corner);
            const count = blockVertexRefs.get(key) ?? 0;
            if (count <= 1) {
                blockVertexRefs.delete(key);
                const entries = entryManager.getPointEntriesByKey(key);
                for (const pointEntry of entries) {
                    if (pointEntry.source !== 'block') continue;
                    pointEntry.active = false;
                    entryManager.refreshEntryVisibility(pointEntry);
                }
            } else {
                blockVertexRefs.set(key, count - 1);
            }
        }
    }

    function syncBlockVertices(entry) {
        if (!entryManager) return;
        if (entry.active && !entry.vertexActive) {
            addBlockVertices(entry);
            entry.vertexActive = true;
        } else if (!entry.active && entry.vertexActive) {
            removeBlockVertices(entry);
            entry.vertexActive = false;
        }
    }

    function updateAppearance(entry) {
        if (!entry.mesh.material) return;
        const material = entry.mesh.material;
        const useActive = entry.hovered || entry.selected;
        material.color.setHex(useActive ? ACTIVE_COLOR : BASE_COLOR);
        if (material.emissive) {
            material.emissive.setHex(useActive ? ACTIVE_EMISSIVE : 0x000000);
        }
        if (entry.outline?.material) {
            entry.outline.material.color.setHex(OUTLINE_COLOR);
            entry.outline.visible = entry.active;
        }
        entry.mesh.visible = entry.active;
    }

    function refreshEntryVisibility(entry) {
        syncBlockVertices(entry);
        updateAppearance(entry);
        if (!entry.active) {
            removeEntryFromScene(entry);
            return;
        }
        addEntryToScene(entry);
    }

    function getBlockKey(position, size) {
        return `${getVertexKey(position)}|${roundCoord(size)}`;
    }

    function isPointInsideBlock(point, entry) {
        const size = entry.size ?? 1;
        const half = size / 2;
        const epsilon = 1e-4;
        return (
            point.x >= entry.position.x - half - epsilon &&
            point.x <= entry.position.x + half + epsilon &&
            point.y >= entry.position.y - half - epsilon &&
            point.y <= entry.position.y + half + epsilon &&
            point.z >= entry.position.z - half - epsilon &&
            point.z <= entry.position.z + half + epsilon
        );
    }

    function isPositionOccupied(point, excludedEntry = null) {
        return blockEntries.some((entry) => entry.active && entry !== excludedEntry && isPointInsideBlock(point, entry));
    }

    function registerBlock(position, size = 1, geometryTypeOverride = null) {
        const key = getBlockKey(position, size);
        const existing = blockEntriesByKey.get(key);
        if (existing) {
            const wasInactive = !existing.active;
            if (wasInactive) {
                // Si el bloque existía y estaba inactivo, se reactiva.
                // Como es tipo Minecraft, no cambiamos la geometría aquí para preservar como fue creado
                existing.active = true;
                refreshEntryVisibility(existing);
            }
            return { entry: existing, created: wasInactive };
        }

        const geometryType = geometryTypeOverride || state.currentGeometryType || 'cube';
        const geometry = state.geometries[geometryType] || state.geometries.cube;

        const mesh = new THREE.Mesh(geometry, state.blockMaterial.clone());
        const outline = createBlockOutline(geometry);
        mesh.add(outline);
        mesh.position.copy(position);
        mesh.scale.setScalar(size);
        mesh.renderOrder = 1;
        const entry = {
            mesh,
            outline,
            position: position.clone(),
            key,
            size,
            geometryType, // Save type for exports or serialization if needed later
            active: true,
            hovered: false,
            selected: false,
            inScene: false,
            vertexActive: false
        };
        blockEntries.push(entry);
        blockEntriesByKey.set(key, entry);
        meshToBlockEntry.set(mesh, entry);
        refreshEntryVisibility(entry);
        return { entry, created: true };
    }

    function setHovered(entry, hovered) {
        if (!entry) return;
        entry.hovered = hovered;
        refreshEntryVisibility(entry);
    }

    function setSelected(entry, selected) {
        if (!entry) return;
        entry.selected = selected;
        refreshEntryVisibility(entry);
    }

    function getBlockEntries() {
        return blockEntries;
    }

    function getBlockByMesh(mesh) {
        return meshToBlockEntry.get(mesh) ?? null;
    }

    function getBlockByKey(key) {
        return blockEntriesByKey.get(key) ?? null;
    }

    function splitBlock(entry) {
        if (!entry || !entry.active) return null;
        const size = entry.size ?? 1;
        const childSize = size / 2;
        const offset = size / 4;
        const offsets = [-offset, offset];
        const childPositions = [];
        for (const ox of offsets) {
            for (const oy of offsets) {
                for (const oz of offsets) {
                    childPositions.push(new THREE.Vector3(
                        entry.position.x + ox,
                        entry.position.y + oy,
                        entry.position.z + oz
                    ));
                }
            }
        }

        for (const pos of childPositions) {
            const key = getBlockKey(pos, childSize);
            const existing = blockEntriesByKey.get(key);
            if (existing && existing.active) {
                return null;
            }
        }

        const children = [];
        for (const pos of childPositions) {
            const result = registerBlock(pos, childSize);
            children.push(result.entry);
        }

        entry.active = false;
        entry.hovered = false;
        entry.selected = false;
        refreshEntryVisibility(entry);

        return { parent: entry, children, childSize };
    }

    function updateBlockPosition(entry, newPosition) {
        if (!entry) return;

        const wasActive = entry.active;
        if (wasActive) {
            entry.active = false;
            refreshEntryVisibility(entry);
        }

        blockEntriesByKey.delete(entry.key);

        entry.position.copy(newPosition);
        entry.mesh.position.copy(newPosition);
        entry.key = getBlockKey(entry.position, entry.size);

        blockEntriesByKey.set(entry.key, entry);

        if (wasActive) {
            entry.active = true;
            refreshEntryVisibility(entry);
        }
    }

    return {
        registerBlock,
        refreshEntryVisibility,
        setHovered,
        setSelected,
        getBlockEntries,
        getBlockByMesh,
        getBlockByKey,
        splitBlock,
        updateBlockPosition,
        isPositionOccupied
    };
}
