import { FACE_EPSILON } from './constants.js';

export function createEntryManager(scene, planeFill) {
    const lineEntries = [];
    const pointEntries = [];
    const pointEntriesByKey = new Map();
    const meshToPointEntry = new WeakMap();

    const POINT_HIDDEN_OPACITY = 0.0;
    const POINT_VISIBLE_OPACITY = 1.0;
    const HOVER_SCALE = 1.6;
    const SELECT_SCALE = 1.9;
    const LOOSE_FACE_COVER_PREFIX = 'loose-face:';

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

    function updatePointAppearance(entry) {
        const material = entry.mesh.material;
        const highlighted = entry.hovered || entry.selected || entry.multiSelected;
        if (material) {
            material.transparent = true;
            material.opacity = entry.active && (entry.faceEligible || highlighted) && (entry.showAlways || highlighted)
                ? POINT_VISIBLE_OPACITY
                : POINT_HIDDEN_OPACITY;
        }
        const scale = entry.selected || entry.multiSelected ? SELECT_SCALE : entry.hovered ? HOVER_SCALE : 1;
        entry.mesh.scale.setScalar(scale);
        entry.mesh.visible = entry.active;
    }

    function refreshEntryVisibility(entry) {
        if (entry.isPoint) {
            updatePointAppearance(entry);
            addEntryToScene(entry);
            return;
        }
        if (!entry.active || entry.coveredBy.size > 0) {
            removeEntryFromScene(entry);
            return;
        }
        addEntryToScene(entry);
    }

    function registerLineEntry(line, start, end) {
        const entry = {
            mesh: line,
            start: start.clone(),
            end: end.clone(),
            active: true,
            coveredBy: new Set(),
            inScene: false,
            isPoint: false
        };
        lineEntries.push(entry);
        refreshEntryVisibility(entry);
        return entry;
    }

    function registerPointEntry(mesh, position, vertexKey, source = 'line') {
        if (mesh.material && mesh.material.clone) {
            mesh.material = mesh.material.clone();
        }
        const entry = {
            mesh,
            position: position.clone(),
            active: true,
            coveredBy: new Set(),
            inScene: false,
            faceEligible: false,
            hovered: false,
            selected: false,
            multiSelected: false,
            showAlways: false,
            vertexKey: vertexKey ?? null,
            isPoint: true,
            source
        };
        pointEntries.push(entry);
        meshToPointEntry.set(mesh, entry);
        if (entry.vertexKey) {
            if (!pointEntriesByKey.has(entry.vertexKey)) {
                pointEntriesByKey.set(entry.vertexKey, new Set());
            }
            pointEntriesByKey.get(entry.vertexKey).add(entry);
        }
        refreshEntryVisibility(entry);
        return entry;
    }

    function parsePlaneKey(planeKey) {
        const parts = planeKey.split(':');
        if (parts.length !== 2) return null;
        return { axis: parts[0], value: Number(parts[1]) };
    }

    function buildEdgeKey(aKey, bKey) {
        return aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
    }

    function isLineOnPlane(entry, axis, value) {
        const start = entry.start;
        const end = entry.end;
        return Math.abs(start[axis] - value) <= FACE_EPSILON && Math.abs(end[axis] - value) <= FACE_EPSILON;
    }

    function isPointOnPlane(entry, axis, value) {
        return Math.abs(entry.position[axis] - value) <= FACE_EPSILON;
    }

    function getPlaneUV(point, axis) {
        if (axis === 'x') return { u: point.y, v: point.z };
        if (axis === 'y') return { u: point.x, v: point.z };
        return { u: point.x, v: point.y };
    }

    function isLineCoveredByCells(entry, axis, cells) {
        const startUV = getPlaneUV(entry.start, axis);
        const endUV = getPlaneUV(entry.end, axis);
        const u1 = Math.round(startUV.u);
        const v1 = Math.round(startUV.v);
        const u2 = Math.round(endUV.u);
        const v2 = Math.round(endUV.v);

        if (u1 !== u2) {
            const uMin = Math.min(u1, u2);
            const v = v1;
            return cells.has(`${uMin},${v}`) || cells.has(`${uMin},${v - 1}`);
        }

        if (v1 !== v2) {
            const vMin = Math.min(v1, v2);
            const u = u1;
            return cells.has(`${u},${vMin}`) || cells.has(`${u - 1},${vMin}`);
        }

        return cells.has(`${u1},${v1}`);
    }

    function isPointCoveredByCells(entry, axis, cells) {
        const uv = getPlaneUV(entry.position, axis);
        const u = Math.round(uv.u);
        const v = Math.round(uv.v);
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

    function updatePlaneVisibility(planeKey) {
        const parsed = parsePlaneKey(planeKey);
        if (!parsed) return;
        const { axis, value } = parsed;
        const data = planeFill.get(planeKey);
        const cells = data ? data.cells : null;

        for (const entry of lineEntries) {
            if (!isLineOnPlane(entry, axis, value)) {
                if (entry.coveredBy.has(planeKey)) {
                    entry.coveredBy.delete(planeKey);
                    refreshEntryVisibility(entry);
                }
                continue;
            }
            const covered = cells ? isLineCoveredByCells(entry, axis, cells) : false;
            if (covered) {
                entry.coveredBy.add(planeKey);
            } else if (entry.coveredBy.has(planeKey)) {
                entry.coveredBy.delete(planeKey);
            }
            refreshEntryVisibility(entry);
        }

        // Keep point markers controlled by face visibility only.
        // We still clean up any stale coverage flags in case they exist.
        for (const entry of pointEntries) {
            if (entry.coveredBy.has(planeKey)) {
                entry.coveredBy.delete(planeKey);
            }
            refreshEntryVisibility(entry);
        }
    }

    function applyLooseFaceVisibility(looseFaceVertices) {
        const looseFaceEdgeCoverage = new Map();

        if (looseFaceVertices) {
            for (const [faceKey, vertices] of looseFaceVertices.entries()) {
                if (!vertices || vertices.length < 2) continue;
                const coverageKey = `${LOOSE_FACE_COVER_PREFIX}${faceKey}`;
                for (let i = 0; i < vertices.length; i++) {
                    const aKey = vertices[i];
                    const bKey = vertices[(i + 1) % vertices.length];
                    if (!aKey || !bKey || aKey === bKey) continue;
                    looseFaceEdgeCoverage.set(buildEdgeKey(aKey, bKey), coverageKey);
                }
            }
        }

        for (const entry of lineEntries) {
            const staleCoverage = [];
            for (const key of entry.coveredBy) {
                if (key.startsWith(LOOSE_FACE_COVER_PREFIX)) {
                    staleCoverage.push(key);
                }
            }
            for (const key of staleCoverage) {
                entry.coveredBy.delete(key);
            }

            const aKey = entry.aKey;
            const bKey = entry.bKey;
            if (aKey && bKey) {
                const coverageKey = looseFaceEdgeCoverage.get(buildEdgeKey(aKey, bKey));
                if (coverageKey) {
                    entry.coveredBy.add(coverageKey);
                }
            }

            refreshEntryVisibility(entry);
        }
    }

    function applyVisibleVertices(visibleSet, showPoints = true) {
        for (const [vertexKey, entries] of pointEntriesByKey.entries()) {
            const eligible = showPoints ? true : visibleSet.has(vertexKey);
            let shown = false;
            for (const entry of entries) {
                if (!entry.active) {
                    entry.faceEligible = false;
                    entry.hovered = false;
                    entry.selected = false;
                    entry.multiSelected = false;
                    refreshEntryVisibility(entry);
                    continue;
                }
                entry.faceEligible = eligible;
                if (!eligible) {
                    entry.hovered = false;
                    entry.selected = false;
                }
                entry.showAlways = showPoints && eligible && !shown;
                if (entry.showAlways) {
                    shown = true;
                }
                refreshEntryVisibility(entry);
            }
        }
    }

    function setHovered(entry, hovered) {
        if (!entry || !entry.isPoint) return;
        entry.hovered = hovered;
        refreshEntryVisibility(entry);
    }

    function setSelected(entry, selected) {
        if (!entry || !entry.isPoint) return;
        entry.selected = selected;
        refreshEntryVisibility(entry);
    }

    function setMultiSelectedByKey(key, selected) {
        if (!key) return;
        const entries = pointEntriesByKey.get(key);
        if (!entries) return;
        for (const entry of entries) {
            entry.multiSelected = selected;
            refreshEntryVisibility(entry);
        }
    }

    function getPointEntries() {
        return pointEntries;
    }

    function getLineEntries() {
        return lineEntries;
    }

    function getEntryByMesh(mesh) {
        return meshToPointEntry.get(mesh) ?? null;
    }

    function getPointEntriesByKey(key) {
        return pointEntriesByKey.get(key) ?? new Set();
    }

    function movePointEntries(oldKey, newKey, newPosition) {
        if (!oldKey) return [];
        const existing = pointEntriesByKey.get(oldKey);
        if (!existing || existing.size === 0) return [];
        const movedEntries = Array.from(existing);
        if (oldKey !== newKey) {
            pointEntriesByKey.delete(oldKey);
            if (!pointEntriesByKey.has(newKey)) {
                pointEntriesByKey.set(newKey, new Set());
            }
        }
        const targetSet = pointEntriesByKey.get(newKey) ?? new Set();
        for (const entry of movedEntries) {
            entry.position.copy(newPosition);
            entry.mesh.position.copy(newPosition);
            entry.vertexKey = newKey;
            targetSet.add(entry);
            refreshEntryVisibility(entry);
        }
        if (oldKey !== newKey) {
            pointEntriesByKey.set(newKey, targetSet);
        }
        return movedEntries;
    }

    return {
        registerLineEntry,
        registerPointEntry,
        refreshEntryVisibility,
        updatePlaneVisibility,
        applyLooseFaceVisibility,
        applyVisibleVertices,
        setHovered,
        setSelected,
        setMultiSelectedByKey,
        getPointEntries,
        getLineEntries,
        getEntryByMesh,
        getPointEntriesByKey,
        movePointEntries,
        getCounts: () => {
            let lines = 0;
            for (const entry of lineEntries) {
                if (entry.active && entry.coveredBy.size === 0) lines += 1;
            }
            let points = 0;
            for (const entry of pointEntries) {
                if (entry.active && entry.faceEligible) points += 1;
            }
            return { lines, points };
        }
    };
}
