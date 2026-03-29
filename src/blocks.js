import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS } from './constants.js';
import { getVertexKey } from './geometry.js';

const BLOCK_EPSILON = 1e-4;
const PRISM_GROW_ORDERS = [
    ['x', 'y', 'z'],
    ['x', 'z', 'y'],
    ['y', 'x', 'z'],
    ['y', 'z', 'x'],
    ['z', 'x', 'y'],
    ['z', 'y', 'x']
];
const EXACT_COVER_MAX_COMPONENT_CELLS = 32;
const EXACT_COVER_MAX_STATES = 50000;

function formatBlockNumber(value) {
    const normalized = Math.abs(value) < 1e-6 ? 0 : value;
    return normalized.toFixed(6);
}

function getBlockDimensions(entry) {
    if (entry?.dimensions?.isVector3) {
        return entry.dimensions.clone();
    }
    const size = entry?.size ?? 1;
    return new THREE.Vector3(size, size, size);
}

function getBlockMinCorner(entry) {
    const dimensions = getBlockDimensions(entry);
    return entry.position.clone().sub(dimensions.multiplyScalar(0.5));
}

function getCellKey(x, y, z) {
    return `${x},${y},${z}`;
}

function parseCellKey(key) {
    const [x, y, z] = key.split(',').map(Number);
    return { x, y, z };
}

function compareCells(a, b) {
    return a.y - b.y || a.z - b.z || a.x - b.x;
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

function getGridIndex(value, offset, size) {
    const rawIndex = (value - offset) / size;
    const roundedIndex = Math.round(rawIndex);
    if (Math.abs(rawIndex - roundedIndex) > BLOCK_EPSILON) {
        return null;
    }
    return roundedIndex;
}

function getCellSpan(length, size) {
    const rawSpan = length / size;
    const roundedSpan = Math.round(rawSpan);
    if (roundedSpan <= 0 || Math.abs(rawSpan - roundedSpan) > BLOCK_EPSILON) {
        return null;
    }
    return roundedSpan;
}

function getEntryGridOffset(entry) {
    const size = entry.size ?? 1;
    const minCorner = getBlockMinCorner(entry);
    return new THREE.Vector3(
        normalizeGridOffset(minCorner.x, size),
        normalizeGridOffset(minCorner.y, size),
        normalizeGridOffset(minCorner.z, size)
    );
}

function getOptimizationGroupKey(entry) {
    const offset = getEntryGridOffset(entry);
    return [
        formatBlockNumber(entry.size ?? 1),
        formatBlockNumber(offset.x),
        formatBlockNumber(offset.y),
        formatBlockNumber(offset.z)
    ].join('|');
}

function getRegionVolume(lengths) {
    return lengths.x * lengths.y * lengths.z;
}

function getTieBreakerScore(lengths) {
    return lengths.x + lengths.y + lengths.z;
}

function getOccupiedBounds(occupied) {
    const bounds = {
        minX: Infinity,
        minY: Infinity,
        minZ: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
        maxZ: -Infinity
    };

    for (const key of occupied) {
        const cell = parseCellKey(key);
        bounds.minX = Math.min(bounds.minX, cell.x);
        bounds.minY = Math.min(bounds.minY, cell.y);
        bounds.minZ = Math.min(bounds.minZ, cell.z);
        bounds.maxX = Math.max(bounds.maxX, cell.x);
        bounds.maxY = Math.max(bounds.maxY, cell.y);
        bounds.maxZ = Math.max(bounds.maxZ, cell.z);
    }

    return bounds;
}

function createPrismFromBounds(bounds) {
    return {
        start: {
            x: bounds.minX,
            y: bounds.minY,
            z: bounds.minZ
        },
        lengths: {
            x: bounds.maxX - bounds.minX + 1,
            y: bounds.maxY - bounds.minY + 1,
            z: bounds.maxZ - bounds.minZ + 1
        }
    };
}

function getExactBoxIfRectangular(occupied) {
    if (!occupied || occupied.size === 0) return [];
    const bounds = getOccupiedBounds(occupied);
    const prism = createPrismFromBounds(bounds);
    if (getRegionVolume(prism.lengths) !== occupied.size) {
        return null;
    }
    return [prism];
}

function getConnectedCellComponents(occupied) {
    const components = [];
    const visited = new Set();

    for (const key of occupied) {
        if (visited.has(key)) continue;

        const component = new Set();
        const queue = [key];
        visited.add(key);

        while (queue.length > 0) {
            const currentKey = queue.shift();
            component.add(currentKey);
            const current = parseCellKey(currentKey);
            const neighbors = [
                getCellKey(current.x - 1, current.y, current.z),
                getCellKey(current.x + 1, current.y, current.z),
                getCellKey(current.x, current.y - 1, current.z),
                getCellKey(current.x, current.y + 1, current.z),
                getCellKey(current.x, current.y, current.z - 1),
                getCellKey(current.x, current.y, current.z + 1)
            ];

            for (const neighborKey of neighbors) {
                if (!occupied.has(neighborKey) || visited.has(neighborKey)) continue;
                visited.add(neighborKey);
                queue.push(neighborKey);
            }
        }

        components.push(component);
    }

    return components;
}

function removePrismCells(occupied, prism) {
    const next = new Set(occupied);
    for (let y = prism.start.y; y < prism.start.y + prism.lengths.y; y += 1) {
        for (let z = prism.start.z; z < prism.start.z + prism.lengths.z; z += 1) {
            for (let x = prism.start.x; x < prism.start.x + prism.lengths.x; x += 1) {
                next.delete(getCellKey(x, y, z));
            }
        }
    }
    return next;
}

function getOccupancyStateKey(occupied) {
    return Array.from(occupied).sort().join('|');
}

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

    function getBlockKey(position, size, geometryType = 'cube', dimensions = null, shapeSignature = '') {
        const resolvedDimensions = dimensions ?? new THREE.Vector3(size, size, size);
        const parts = [
            geometryType,
            getVertexKey(position),
            formatBlockNumber(resolvedDimensions.x),
            formatBlockNumber(resolvedDimensions.y),
            formatBlockNumber(resolvedDimensions.z),
            formatBlockNumber(size)
        ];
        if (shapeSignature) {
            parts.push(shapeSignature);
        }
        return parts.join('|');
    }

    function getBlockGeometryVertices(entry) {
        const geometry = entry?.mesh?.geometry;
        const positionAttribute = geometry?.getAttribute?.('position');
        if (!positionAttribute) {
            return [];
        }

        const vertices = [];
        const seen = new Set();
        entry.mesh.updateMatrixWorld(true);

        for (let index = 0; index < positionAttribute.count; index += 1) {
            const vertex = new THREE.Vector3()
                .fromBufferAttribute(positionAttribute, index)
                .applyMatrix4(entry.mesh.matrixWorld);
            const key = getVertexKey(vertex);
            if (seen.has(key)) continue;
            seen.add(key);
            vertices.push(vertex);
        }

        return vertices;
    }

    function getBlockCorners(entry) {
        if (entry?.vertexMode === 'none') {
            return [];
        }
        if (entry?.vertexMode === 'geometry') {
            return getBlockGeometryVertices(entry);
        }
        const half = getBlockDimensions(entry).multiplyScalar(0.5);
        const offsets = [-1, 1];
        const corners = [];
        for (const ox of offsets) {
            for (const oy of offsets) {
                for (const oz of offsets) {
                    corners.push(new THREE.Vector3(
                        entry.position.x + half.x * ox,
                        entry.position.y + half.y * oy,
                        entry.position.z + half.z * oz
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
        if (entry?.vertexMode === 'none') {
            if (entry.vertexActive) {
                removeBlockVertices(entry);
                entry.vertexActive = false;
            }
            return;
        }
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
        const useActive = entry.hovered || entry.selected;
        const materials = Array.isArray(entry.mesh.material)
            ? entry.mesh.material
            : [entry.mesh.material];

        materials.forEach((material, index) => {
            const baseColor = entry.baseMaterialColors?.[index] ?? BASE_COLOR;
            if (material?.color?.setHex) {
                material.color.setHex(
                    entry.preserveMaterialColors
                        ? baseColor
                        : useActive ? ACTIVE_COLOR : BASE_COLOR
                );
            }
            if (material?.emissive?.setHex) {
                material.emissive.setHex(useActive ? ACTIVE_EMISSIVE : 0x000000);
            }
        });
        if (entry.outline?.material) {
            entry.outline.material.color.setHex(useActive ? ACTIVE_COLOR : OUTLINE_COLOR);
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

    function isPointInsideBlock(point, entry) {
        const half = getBlockDimensions(entry).multiplyScalar(0.5);
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

    function isPositionOccupied(point, excludedEntry = null) {
        return blockEntries.some((entry) => entry.active && entry !== excludedEntry && isPointInsideBlock(point, entry));
    }

    function applyMeshScale(mesh, geometryType, dimensions, size) {
        if (geometryType === 'cube') {
            mesh.scale.copy(dimensions);
            return;
        }
        mesh.scale.setScalar(size);
    }

    function registerBlockShape({
        position,
        size = 1,
        geometryType = null,
        dimensions = null,
        geometry = null,
        material = null,
        shapeSignature = '',
        vertexMode = 'corners',
        surfaceCount = null,
        voxelLocalCells = null,
        preserveMaterialColors = false
    }) {
        const resolvedGeometryType = geometryType || state.currentGeometryType || 'cube';
        const resolvedDimensions = dimensions?.clone() ?? new THREE.Vector3(size, size, size);
        const key = getBlockKey(position, size, resolvedGeometryType, resolvedDimensions, shapeSignature);
        const existing = blockEntriesByKey.get(key);
        if (existing) {
            const wasInactive = !existing.active;
            if (wasInactive) {
                existing.active = true;
                refreshEntryVisibility(existing);
            }
            return { entry: existing, created: wasInactive };
        }

        const resolvedGeometry = geometry ?? (state.geometries[resolvedGeometryType] || state.geometries.cube);
        const baseMaterial = material ?? state.blockMaterial;
        const resolvedMaterial = Array.isArray(baseMaterial)
            ? baseMaterial.map((item) => item.clone())
            : baseMaterial.clone();
        const mesh = new THREE.Mesh(resolvedGeometry, resolvedMaterial);
        const outline = createBlockOutline(resolvedGeometry);
        mesh.add(outline);
        mesh.position.copy(position);
        if (geometry) {
            mesh.scale.set(1, 1, 1);
        } else {
            applyMeshScale(mesh, resolvedGeometryType, resolvedDimensions, size);
        }
        mesh.renderOrder = 1;

        const entry = {
            mesh,
            outline,
            position: position.clone(),
            key,
            size,
            dimensions: resolvedDimensions,
            geometryType: resolvedGeometryType,
            shapeSignature,
            vertexMode,
            surfaceCount,
            voxelLocalCells: Array.isArray(voxelLocalCells) ? [...voxelLocalCells] : null,
            preserveMaterialColors,
            baseMaterialColors: (Array.isArray(resolvedMaterial) ? resolvedMaterial : [resolvedMaterial]).map((item) => (
                item?.color?.getHex ? item.color.getHex() : null
            )),
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

    function registerBlock(position, size = 1, geometryTypeOverride = null) {
        return registerBlockShape({
            position,
            size,
            geometryType: geometryTypeOverride || state.currentGeometryType || 'cube',
            dimensions: new THREE.Vector3(size, size, size)
        });
    }

    function registerBox(position, dimensions, size = 1, geometryType = 'cube') {
        return registerBlockShape({
            position,
            size,
            geometryType,
            dimensions
        });
    }

    function registerCustomBlockShape(options = {}) {
        return registerBlockShape(options);
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

    function getSelectedEntries() {
        if (!Array.isArray(state.selectedBlocks)) {
            state.selectedBlocks = [];
        }

        const nextSelected = [];
        const seen = new Set();
        for (const entry of state.selectedBlocks) {
            if (!entry?.active) {
                if (entry?.selected) {
                    entry.selected = false;
                    refreshEntryVisibility(entry);
                }
                continue;
            }
            if (seen.has(entry)) continue;
            seen.add(entry);
            nextSelected.push(entry);
        }

        if (
            nextSelected.length !== state.selectedBlocks.length
            || nextSelected.some((entry, index) => state.selectedBlocks[index] !== entry)
        ) {
            state.selectedBlocks = nextSelected;
        }

        if (!state.selectedBlock?.active || (state.selectedBlock && !seen.has(state.selectedBlock))) {
            state.selectedBlock = nextSelected[nextSelected.length - 1] ?? null;
        }
        if (state.hoveredBlock && !state.hoveredBlock.active) {
            state.hoveredBlock = null;
        }

        return nextSelected;
    }

    function setSelection(entries, primaryEntry = null) {
        const previousEntries = getSelectedEntries();
        const previousSet = new Set(previousEntries);
        const nextEntries = [];
        const nextSet = new Set();

        for (const entry of entries) {
            if (!entry?.active || nextSet.has(entry)) continue;
            nextSet.add(entry);
            nextEntries.push(entry);
        }

        for (const entry of previousEntries) {
            if (!nextSet.has(entry)) {
                setSelected(entry, false);
            }
        }

        for (const entry of nextEntries) {
            if (!previousSet.has(entry) || !entry.selected) {
                setSelected(entry, true);
            }
        }

        state.selectedBlocks = nextEntries;
        state.selectedBlock = primaryEntry && nextSet.has(primaryEntry)
            ? primaryEntry
            : nextEntries[nextEntries.length - 1] ?? null;

        return nextEntries;
    }

    function clearSelection() {
        setSelection([]);
    }

    function isSelected(entry) {
        return getSelectedEntries().includes(entry);
    }

    function addToSelection(entry, { makePrimary = true } = {}) {
        if (!entry?.active) return getSelectedEntries();
        const nextEntries = getSelectedEntries();
        if (!nextEntries.includes(entry)) {
            nextEntries.push(entry);
        }
        return setSelection(nextEntries, makePrimary ? entry : state.selectedBlock);
    }

    function removeFromSelection(entry) {
        if (!entry) return getSelectedEntries();
        const nextEntries = getSelectedEntries().filter((candidate) => candidate !== entry);
        const nextPrimary = state.selectedBlock === entry
            ? nextEntries[nextEntries.length - 1] ?? null
            : state.selectedBlock;
        return setSelection(nextEntries, nextPrimary);
    }

    function toggleSelection(entry, { makePrimary = true } = {}) {
        if (!entry?.active) return false;
        if (isSelected(entry)) {
            removeFromSelection(entry);
            return false;
        }
        addToSelection(entry, { makePrimary });
        return true;
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

    function canSplitBlock(entry) {
        if (!entry || !entry.active) return false;
        if (entry.geometryType !== 'cube') return false;
        const dimensions = getBlockDimensions(entry);
        return (
            Math.abs(dimensions.x - dimensions.y) <= BLOCK_EPSILON &&
            Math.abs(dimensions.x - dimensions.z) <= BLOCK_EPSILON &&
            dimensions.x > BLOCK_EPSILON
        );
    }

    function splitBlock(entry) {
        if (!canSplitBlock(entry)) return null;

        const dimension = getBlockDimensions(entry).x;
        const childSize = dimension / 2;
        const offset = dimension / 4;
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
            const key = getBlockKey(pos, childSize, entry.geometryType, new THREE.Vector3(childSize, childSize, childSize));
            const existing = blockEntriesByKey.get(key);
            if (existing && existing.active) {
                return null;
            }
        }

        const children = [];
        for (const pos of childPositions) {
            const result = registerBlock(pos, childSize, entry.geometryType);
            children.push(result.entry);
        }

        entry.active = false;
        entry.hovered = false;
        entry.selected = false;
        refreshEntryVisibility(entry);
        removeFromSelection(entry);

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
        entry.key = getBlockKey(
            entry.position,
            entry.size,
            entry.geometryType,
            getBlockDimensions(entry),
            entry.shapeSignature ?? ''
        );

        blockEntriesByKey.set(entry.key, entry);

        if (wasActive) {
            entry.active = true;
            refreshEntryVisibility(entry);
        }
    }

    function canOptimizeEntry(entry) {
        if (!entry?.active || entry.geometryType !== 'cube') return false;
        const size = entry.size ?? 1;
        if (!Number.isFinite(size) || size <= 0) return false;
        const dimensions = getBlockDimensions(entry);
        return (
            getCellSpan(dimensions.x, size) !== null &&
            getCellSpan(dimensions.y, size) !== null &&
            getCellSpan(dimensions.z, size) !== null
        );
    }

    function getEntryCellBounds(entry, offset) {
        const size = entry.size ?? 1;
        const dimensions = getBlockDimensions(entry);
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

    function isRegionAvailable(start, lengths, occupied, used) {
        for (let y = start.y; y < start.y + lengths.y; y += 1) {
            for (let z = start.z; z < start.z + lengths.z; z += 1) {
                for (let x = start.x; x < start.x + lengths.x; x += 1) {
                    const key = getCellKey(x, y, z);
                    if (!occupied.has(key) || used.has(key)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    function canGrowPrism(start, lengths, axis, occupied, used) {
        const nextLengths = { ...lengths, [axis]: lengths[axis] + 1 };
        return isRegionAvailable(start, nextLengths, occupied, used);
    }

    function growPrism(start, occupied, used, order) {
        const lengths = { x: 1, y: 1, z: 1 };
        for (const axis of order) {
            while (canGrowPrism(start, lengths, axis, occupied, used)) {
                lengths[axis] += 1;
            }
        }
        return { start, lengths };
    }

    function buildPrismsFromCells(occupied) {
        const used = new Set();
        const prisms = [];
        const orderedCells = Array.from(occupied)
            .map(parseCellKey)
            .sort(compareCells);

        for (const cell of orderedCells) {
            const startKey = getCellKey(cell.x, cell.y, cell.z);
            if (used.has(startKey)) continue;

            let bestPrism = null;
            let bestVolume = -1;
            let bestScore = -1;

            for (const order of PRISM_GROW_ORDERS) {
                const prism = growPrism(cell, occupied, used, order);
                const volume = getRegionVolume(prism.lengths);
                const score = getTieBreakerScore(prism.lengths);
                if (volume > bestVolume || (volume === bestVolume && score > bestScore)) {
                    bestPrism = prism;
                    bestVolume = volume;
                    bestScore = score;
                }
            }

            if (!bestPrism) {
                continue;
            }

            for (let y = bestPrism.start.y; y < bestPrism.start.y + bestPrism.lengths.y; y += 1) {
                for (let z = bestPrism.start.z; z < bestPrism.start.z + bestPrism.lengths.z; z += 1) {
                    for (let x = bestPrism.start.x; x < bestPrism.start.x + bestPrism.lengths.x; x += 1) {
                        used.add(getCellKey(x, y, z));
                    }
                }
            }

            prisms.push(bestPrism);
        }

        return prisms;
    }

    function enumeratePrismsFromAnchor(anchor, occupied) {
        const bounds = getOccupiedBounds(occupied);
        const prisms = [];

        for (let maxX = anchor.x; maxX <= bounds.maxX; maxX += 1) {
            let baseSliceValid = true;
            for (let x = anchor.x; x <= maxX; x += 1) {
                if (occupied.has(getCellKey(x, anchor.y, anchor.z))) continue;
                baseSliceValid = false;
                break;
            }
            if (!baseSliceValid) break;

            for (let maxY = anchor.y; maxY <= bounds.maxY; maxY += 1) {
                let rectangleValid = true;
                for (let y = anchor.y; y <= maxY && rectangleValid; y += 1) {
                    for (let x = anchor.x; x <= maxX; x += 1) {
                        if (occupied.has(getCellKey(x, y, anchor.z))) continue;
                        rectangleValid = false;
                        break;
                    }
                }
                if (!rectangleValid) break;

                for (let maxZ = anchor.z; maxZ <= bounds.maxZ; maxZ += 1) {
                    let prismValid = true;
                    for (let z = anchor.z; z <= maxZ && prismValid; z += 1) {
                        for (let y = anchor.y; y <= maxY && prismValid; y += 1) {
                            for (let x = anchor.x; x <= maxX; x += 1) {
                                if (occupied.has(getCellKey(x, y, z))) continue;
                                prismValid = false;
                                break;
                            }
                        }
                    }
                    if (!prismValid) break;

                    prisms.push({
                        start: { ...anchor },
                        lengths: {
                            x: maxX - anchor.x + 1,
                            y: maxY - anchor.y + 1,
                            z: maxZ - anchor.z + 1
                        }
                    });
                }
            }
        }

        prisms.sort((a, b) => {
            const volumeDifference = getRegionVolume(b.lengths) - getRegionVolume(a.lengths);
            if (volumeDifference !== 0) return volumeDifference;
            return getTieBreakerScore(b.lengths) - getTieBreakerScore(a.lengths);
        });

        return prisms;
    }

    function findExactPrismCover(occupied) {
        if (!occupied || occupied.size === 0) {
            return [];
        }

        const rectangularCover = getExactBoxIfRectangular(occupied);
        if (rectangularCover) {
            return rectangularCover;
        }

        if (occupied.size > EXACT_COVER_MAX_COMPONENT_CELLS) {
            return null;
        }

        const memo = new Map();
        let visitedStates = 0;
        let aborted = false;

        function search(current) {
            if (aborted) return null;
            if (current.size === 0) return [];

            const currentKey = getOccupancyStateKey(current);
            if (memo.has(currentKey)) {
                return memo.get(currentKey);
            }

            visitedStates += 1;
            if (visitedStates > EXACT_COVER_MAX_STATES) {
                aborted = true;
                return null;
            }

            const orderedCells = Array.from(current)
                .map(parseCellKey)
                .sort(compareCells);
            const anchor = orderedCells[0];
            const candidatePrisms = enumeratePrismsFromAnchor(anchor, current);
            let bestCover = null;
            let bestCount = Infinity;

            for (const prism of candidatePrisms) {
                const remaining = removePrismCells(current, prism);
                const minimumPossibleCount = 1 + getConnectedCellComponents(remaining).length;
                if (minimumPossibleCount >= bestCount) {
                    continue;
                }

                const tailCover = search(remaining);
                if (aborted || tailCover === null) {
                    continue;
                }

                const candidateCover = [prism, ...tailCover];
                if (candidateCover.length >= bestCount) {
                    continue;
                }

                bestCover = candidateCover;
                bestCount = candidateCover.length;
            }

            memo.set(currentKey, bestCover);
            return bestCover;
        }

        const result = search(occupied);
        if (aborted) {
            return null;
        }
        return result;
    }

    function buildOptimalPrismsFromCells(occupied) {
        const prisms = [];
        const components = getConnectedCellComponents(occupied);

        for (const component of components) {
            const optimizedComponent = findExactPrismCover(component);
            if (optimizedComponent) {
                prisms.push(...optimizedComponent);
                continue;
            }
            prisms.push(...buildPrismsFromCells(component));
        }

        return prisms;
    }

    function mergePlaneCells(cells) {
        const ordered = Array.from(cells).sort((a, b) => a.v - b.v || a.u - b.u);
        const used = new Set();
        const rects = [];

        for (const cell of ordered) {
            const startKey = getCellKey(cell.u, cell.v, 0);
            if (used.has(startKey)) continue;

            let width = 1;
            while (
                cells.some((candidate) => candidate.u === cell.u + width && candidate.v === cell.v)
                && !used.has(getCellKey(cell.u + width, cell.v, 0))
            ) {
                width += 1;
            }

            let height = 1;
            heightLoop: while (true) {
                const nextV = cell.v + height;
                for (let du = 0; du < width; du += 1) {
                    const nextKey = getCellKey(cell.u + du, nextV, 0);
                    if (
                        !cells.some((candidate) => candidate.u === cell.u + du && candidate.v === nextV)
                        || used.has(nextKey)
                    ) {
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

    function pushQuad(positions, normals, uvs, vertices, normal, pivot = null) {
        const triangleOrder = [0, 1, 2, 0, 2, 3];
        const quadUvs = [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1]
        ];

        for (const index of triangleOrder) {
            const vertex = vertices[index];
            const localVertex = pivot ? vertex.clone().sub(pivot) : vertex;
            positions.push(localVertex.x, localVertex.y, localVertex.z);
            normals.push(normal.x, normal.y, normal.z);
            const uv = quadUvs[index];
            uvs.push(uv[0], uv[1]);
        }
    }

    function createMergedGeometryFromCells(occupied, size, origin, pivot = null) {
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
        const uvs = [];
        let surfaceCount = 0;

        for (const [planeKey, cells] of planeFaces.entries()) {
            const [axis, directionText, planeText] = planeKey.split(':');
            const direction = Number(directionText);
            const plane = Number(planeText);
            const rects = mergePlaneCells(cells);
            surfaceCount += rects.length;

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
                        new THREE.Vector3(1, 0, 0),
                        pivot
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
                        new THREE.Vector3(-1, 0, 0),
                        pivot
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
                        new THREE.Vector3(0, 1, 0),
                        pivot
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
                        new THREE.Vector3(0, -1, 0),
                        pivot
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
                        new THREE.Vector3(0, 0, 1),
                        pivot
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
                    new THREE.Vector3(0, 0, -1),
                    pivot
                );
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        const optimizedGeometry = mergeVertices(geometry, 1e-6);
        optimizedGeometry.computeVertexNormals();
        optimizedGeometry.computeBoundingBox();
        optimizedGeometry.computeBoundingSphere();
        optimizedGeometry.userData.surfaceCount = surfaceCount;
        return optimizedGeometry;
    }

    function canCombineIntoCompositeEntry(entry) {
        if (!entry?.active) return false;
        if (Array.isArray(entry.mesh?.material) || entry.mesh?.material?.map) return false;

        if (entry.geometryType === 'merged-cube') {
            return Array.isArray(entry.voxelLocalCells) && entry.voxelLocalCells.length > 0;
        }

        return canOptimizeEntry(entry);
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

    function registerMergedCubeShape({ occupiedCells, size, offset, material }) {
        if (!occupiedCells || occupiedCells.size === 0) {
            return null;
        }

        const bounds = getOccupiedBounds(occupiedCells);
        const localCellKeys = Array.from(occupiedCells, (key) => {
            const cell = parseCellKey(key);
            return getCellKey(
                cell.x - bounds.minX,
                cell.y - bounds.minY,
                cell.z - bounds.minZ
            );
        }).sort();

        const dimensions = new THREE.Vector3(
            (bounds.maxX - bounds.minX + 1) * size,
            (bounds.maxY - bounds.minY + 1) * size,
            (bounds.maxZ - bounds.minZ + 1) * size
        );
        const pivot = dimensions.clone().multiplyScalar(0.5);
        const geometry = createMergedGeometryFromCells(
            new Set(localCellKeys),
            size,
            new THREE.Vector3(0, 0, 0),
            pivot
        );
        const minCorner = new THREE.Vector3(
            offset.x + bounds.minX * size,
            offset.y + bounds.minY * size,
            offset.z + bounds.minZ * size
        );
        const position = minCorner.clone().add(pivot);
        const result = registerBlockShape({
            position,
            size,
            geometryType: 'merged-cube',
            dimensions,
            geometry,
            material,
            shapeSignature: localCellKeys.join(';'),
            vertexMode: 'geometry',
            surfaceCount: geometry.userData.surfaceCount ?? 0,
            voxelLocalCells: localCellKeys
        });

        return result.entry;
    }

    function mergeCompatibleEntriesIntoComposite(compatibleEntries) {
        const occupied = new Set();
        const offset = getEntryGridOffset(compatibleEntries[0]);
        for (const entry of compatibleEntries) {
            if (!appendEntryOccupiedCells(entry, offset, occupied)) {
                return null;
            }
        }

        const mergedEntry = registerMergedCubeShape({
            occupiedCells: occupied,
            size: compatibleEntries[0].size ?? 1,
            offset,
            material: compatibleEntries[0].mesh.material
        });

        if (!mergedEntry) {
            return null;
        }

        const removedEntries = [];
        for (const entry of compatibleEntries) {
            entry.active = false;
            entry.hovered = false;
            entry.selected = false;
            refreshEntryVisibility(entry);
            removeFromSelection(entry);
            removedEntries.push(entry);
        }

        mergedEntry.hovered = false;
        mergedEntry.selected = false;
        refreshEntryVisibility(mergedEntry);

        return {
            removedEntries,
            createdEntries: [mergedEntry],
            resultingEntries: [mergedEntry],
            beforeCount: compatibleEntries.length,
            afterCount: 1
        };
    }

    function mergeEntriesIntoComposite(targetEntries) {
        const uniqueEntries = [];
        const seenEntries = new Set();
        const rejectedEntries = [];

        for (const entry of targetEntries) {
            if (!entry || seenEntries.has(entry)) continue;
            seenEntries.add(entry);
            if (!canCombineIntoCompositeEntry(entry)) {
                rejectedEntries.push(entry);
                continue;
            }
            uniqueEntries.push(entry);
        }

        if (uniqueEntries.length < 2) {
            return {
                changed: false,
                removedEntries: [],
                createdEntries: [],
                resultingEntries: [],
                rejectedEntries
            };
        }

        const groupKey = getOptimizationGroupKey(uniqueEntries[0]);
        const compatibleEntries = [];
        for (const entry of uniqueEntries) {
            if (getOptimizationGroupKey(entry) !== groupKey) {
                rejectedEntries.push(entry);
                continue;
            }
            compatibleEntries.push(entry);
        }

        if (compatibleEntries.length < 2) {
            return {
                changed: false,
                removedEntries: [],
                createdEntries: [],
                resultingEntries: [],
                rejectedEntries
            };
        }

        const mergedResult = mergeCompatibleEntriesIntoComposite(compatibleEntries);
        if (!mergedResult) {
            return {
                changed: false,
                removedEntries: [],
                createdEntries: [],
                resultingEntries: [],
                rejectedEntries
            };
        }

        return {
            changed: true,
            removedEntries: mergedResult.removedEntries,
            createdEntries: mergedResult.createdEntries,
            resultingEntries: mergedResult.resultingEntries,
            rejectedEntries,
            beforeCount: mergedResult.beforeCount,
            afterCount: mergedResult.afterCount
        };
    }

    function mergeAllEntriesIntoComposite(targetEntries = null) {
        const sourceEntries = Array.isArray(targetEntries) ? targetEntries : blockEntries;
        const uniqueEntries = [];
        const seenEntries = new Set();
        const rejectedEntries = [];
        const groups = new Map();
        const removedEntries = [];
        const createdEntries = [];
        const resultingEntries = [];
        let beforeCount = 0;
        let afterCount = 0;

        for (const entry of sourceEntries) {
            if (!entry?.active || seenEntries.has(entry)) continue;
            seenEntries.add(entry);
            uniqueEntries.push(entry);
        }

        for (const entry of uniqueEntries) {
            if (!canCombineIntoCompositeEntry(entry)) {
                rejectedEntries.push(entry);
                continue;
            }
            const groupKey = getOptimizationGroupKey(entry);
            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey).push(entry);
        }

        for (const entries of groups.values()) {
            if (entries.length < 2) continue;
            const mergedResult = mergeCompatibleEntriesIntoComposite(entries);
            if (!mergedResult) continue;
            removedEntries.push(...mergedResult.removedEntries);
            createdEntries.push(...mergedResult.createdEntries);
            resultingEntries.push(...mergedResult.resultingEntries);
            beforeCount += mergedResult.beforeCount;
            afterCount += mergedResult.afterCount;
        }

        return {
            changed: removedEntries.length > 0,
            removedEntries,
            createdEntries,
            resultingEntries,
            rejectedEntries,
            beforeCount,
            afterCount
        };
    }

    function createBoxDescriptorFromPrism(prism, size, offset) {
        const dimensions = new THREE.Vector3(
            prism.lengths.x * size,
            prism.lengths.y * size,
            prism.lengths.z * size
        );
        const minCorner = new THREE.Vector3(
            offset.x + prism.start.x * size,
            offset.y + prism.start.y * size,
            offset.z + prism.start.z * size
        );
        const position = minCorner.clone().add(dimensions.clone().multiplyScalar(0.5));
        return { position, dimensions };
    }

    function optimizeBlocks(targetEntries = null) {
        const groups = new Map();
        const sourceEntries = Array.isArray(targetEntries) ? targetEntries : blockEntries;
        const uniqueEntries = [];
        const seenEntries = new Set();
        const rejectedEntries = [];

        for (const entry of sourceEntries) {
            if (!entry || seenEntries.has(entry)) continue;
            seenEntries.add(entry);
            uniqueEntries.push(entry);
        }

        for (const entry of uniqueEntries) {
            if (!canOptimizeEntry(entry)) {
                if (Array.isArray(targetEntries) && entry?.active) {
                    rejectedEntries.push(entry);
                }
                continue;
            }
            const groupKey = getOptimizationGroupKey(entry);
            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    size: entry.size ?? 1,
                    offset: getEntryGridOffset(entry),
                    entries: []
                });
            }
            groups.get(groupKey).entries.push(entry);
        }

        const removedEntries = [];
        const createdEntries = [];
        let beforeCount = 0;
        let afterCount = 0;

        for (const group of groups.values()) {
            if (group.entries.length < 2) continue;

            const occupied = new Set();
            let validGroup = true;

            for (const entry of group.entries) {
                const bounds = getEntryCellBounds(entry, group.offset);
                if (!bounds) {
                    validGroup = false;
                    break;
                }

                for (let y = bounds.start.y; y < bounds.start.y + bounds.spans.y; y += 1) {
                    for (let z = bounds.start.z; z < bounds.start.z + bounds.spans.z; z += 1) {
                        for (let x = bounds.start.x; x < bounds.start.x + bounds.spans.x; x += 1) {
                            occupied.add(getCellKey(x, y, z));
                        }
                    }
                }
            }

            if (!validGroup || occupied.size === 0) {
                continue;
            }

            const prisms = buildOptimalPrismsFromCells(occupied);
            if (prisms.length === 0) {
                continue;
            }

            const existingEntriesByKey = new Map(group.entries.map((entry) => [entry.key, entry]));
            const preservedEntries = new Set();
            const boxesToCreate = [];

            for (const prism of prisms) {
                const descriptor = createBoxDescriptorFromPrism(prism, group.size, group.offset);
                const descriptorKey = getBlockKey(descriptor.position, group.size, 'cube', descriptor.dimensions);
                const existingEntry = existingEntriesByKey.get(descriptorKey);
                if (existingEntry) {
                    preservedEntries.add(existingEntry);
                    continue;
                }
                boxesToCreate.push(descriptor);
            }

            const nextCount = preservedEntries.size + boxesToCreate.length;
            if (nextCount >= group.entries.length) {
                continue;
            }

            const entriesToRemove = group.entries.filter((entry) => !preservedEntries.has(entry));
            beforeCount += group.entries.length;
            afterCount += nextCount;

            for (const entry of entriesToRemove) {
                entry.active = false;
                entry.hovered = false;
                entry.selected = false;
                refreshEntryVisibility(entry);
                removedEntries.push(entry);
            }

            for (const descriptor of boxesToCreate) {
                const result = registerBox(descriptor.position, descriptor.dimensions, group.size, 'cube');
                result.entry.hovered = false;
                result.entry.selected = false;
                refreshEntryVisibility(result.entry);
                createdEntries.push(result.entry);
            }
        }

        const resultingEntries = [];
        if (Array.isArray(targetEntries)) {
            const removedEntrySet = new Set(removedEntries);
            const seenResults = new Set();

            for (const entry of uniqueEntries) {
                if (!entry?.active || removedEntrySet.has(entry) || seenResults.has(entry)) continue;
                seenResults.add(entry);
                resultingEntries.push(entry);
            }

            for (const entry of createdEntries) {
                if (seenResults.has(entry)) continue;
                seenResults.add(entry);
                resultingEntries.push(entry);
            }
        }

        getSelectedEntries();

        return {
            changed: removedEntries.length > 0 || createdEntries.length > 0,
            removedEntries,
            createdEntries,
            rejectedEntries,
            resultingEntries,
            beforeCount,
            afterCount
        };
    }

    return {
        registerBlock,
        registerBox,
        registerCustomBlockShape,
        refreshEntryVisibility,
        setHovered,
        setSelected,
        getSelectedEntries,
        setSelection,
        clearSelection,
        isSelected,
        addToSelection,
        removeFromSelection,
        toggleSelection,
        getBlockEntries,
        getBlockByMesh,
        getBlockByKey,
        canSplitBlock,
        splitBlock,
        mergeEntriesIntoComposite,
        mergeAllEntriesIntoComposite,
        optimizeBlocks,
        updateBlockPosition,
        isPositionOccupied
    };
}
