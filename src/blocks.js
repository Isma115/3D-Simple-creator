import * as THREE from 'three';
import { COLORS } from './constants.js';
import { getVertexKey, roundCoord } from './geometry.js';

export function createBlockManager({ scene, state }) {
    const blockEntries = [];
    const blockEntriesByKey = new Map();
    const meshToBlockEntry = new WeakMap();

    const BASE_COLOR = COLORS.face;
    const ACTIVE_COLOR = COLORS.line;
    const ACTIVE_EMISSIVE = 0x331100;

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

    function updateAppearance(entry) {
        if (!entry.mesh.material) return;
        const material = entry.mesh.material;
        const useActive = entry.hovered || entry.selected;
        material.color.setHex(useActive ? ACTIVE_COLOR : BASE_COLOR);
        if (material.emissive) {
            material.emissive.setHex(useActive ? ACTIVE_EMISSIVE : 0x000000);
        }
        entry.mesh.visible = entry.active;
    }

    function refreshEntryVisibility(entry) {
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

    function registerBlock(position, size = 1) {
        const key = getBlockKey(position, size);
        const existing = blockEntriesByKey.get(key);
        if (existing) {
            const wasInactive = !existing.active;
            if (wasInactive) {
                existing.active = true;
                refreshEntryVisibility(existing);
            }
            return { entry: existing, created: wasInactive };
        }

        const mesh = new THREE.Mesh(state.blockGeometry, state.blockMaterial.clone());
        mesh.position.copy(position);
        mesh.scale.setScalar(size);
        mesh.renderOrder = 1;
        const entry = {
            mesh,
            position: position.clone(),
            key,
            size,
            active: true,
            hovered: false,
            selected: false,
            inScene: false
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

        return { parent: entry, children };
    }

    return {
        registerBlock,
        refreshEntryVisibility,
        setHovered,
        setSelected,
        getBlockEntries,
        getBlockByMesh,
        getBlockByKey,
        splitBlock
    };
}
