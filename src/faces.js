import * as THREE from 'three';
import { FACE_EPSILON } from './constants.js';
import { pointsEqual, projectPointsToPlane, getPlaneKey, getAxisAlignedPlane, buildFaceKey, getVertexKey } from './geometry.js';

const FACE_OUTLINE_COLOR = 0xffffff;

function createFaceOutline(geometry) {
    if (!geometry) return null;
    const edges = new THREE.EdgesGeometry(geometry);
    const outline = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
            color: FACE_OUTLINE_COLOR,
            transparent: true,
            opacity: 0.96,
            depthWrite: false
        })
    );
    outline.renderOrder = 3;
    outline.scale.setScalar(1.001);
    outline.userData.isFaceOutline = true;
    return outline;
}

function attachFaceOutline(mesh) {
    if (!mesh?.geometry) return mesh;

    const previousOutline = mesh.children?.find?.((child) => child.userData?.isFaceOutline);
    if (previousOutline) {
        mesh.remove(previousOutline);
        previousOutline.geometry?.dispose?.();
        previousOutline.material?.dispose?.();
    }

    const outline = createFaceOutline(mesh.geometry);
    if (outline) {
        mesh.add(outline);
    }
    return mesh;
}

function removeCollinear2D(points) {
    if (points.length <= 3) return points;
    const result = [];
    const count = points.length;
    const areaEpsilon = 1e-6;
    for (let i = 0; i < count; i++) {
        const prev = points[(i - 1 + count) % count];
        const current = points[i];
        const next = points[(i + 1) % count];
        const area = Math.abs(
            (current.x - prev.x) * (next.y - prev.y) -
            (current.y - prev.y) * (next.x - prev.x)
        );
        if (area > areaEpsilon) {
            result.push(current);
        }
    }
    return result.length >= 3 ? result : points;
}

function getBoundaryCornerVertexKeys(axis, value, cells) {
    const cornerKeys = new Set();
    if (!cells || cells.size === 0) return cornerKeys;

    const cornerFlags = new Map();
    const markCorner = (u, v, horizontal, vertical) => {
        const key = `${u},${v}`;
        const flags = cornerFlags.get(key) ?? { h: false, v: false };
        if (horizontal) flags.h = true;
        if (vertical) flags.v = true;
        cornerFlags.set(key, flags);
    };

    for (const key of cells) {
        const [u, v] = key.split(',').map(Number);
        const left = `${u - 1},${v}`;
        const right = `${u + 1},${v}`;
        const down = `${u},${v - 1}`;
        const up = `${u},${v + 1}`;

        if (!cells.has(left)) {
            markCorner(u, v, false, true);
            markCorner(u, v + 1, false, true);
        }
        if (!cells.has(right)) {
            markCorner(u + 1, v, false, true);
            markCorner(u + 1, v + 1, false, true);
        }
        if (!cells.has(down)) {
            markCorner(u, v, true, false);
            markCorner(u + 1, v, true, false);
        }
        if (!cells.has(up)) {
            markCorner(u, v + 1, true, false);
            markCorner(u + 1, v + 1, true, false);
        }
    }

    for (const [key, flags] of cornerFlags.entries()) {
        if (!flags.h || !flags.v) continue;
        const [u, v] = key.split(',').map(Number);
        if (axis === 'x') cornerKeys.add(getVertexKey(new THREE.Vector3(value, u, v)));
        else if (axis === 'y') cornerKeys.add(getVertexKey(new THREE.Vector3(u, value, v)));
        else cornerKeys.add(getVertexKey(new THREE.Vector3(u, v, value)));
    }

    return cornerKeys;
}

function pointInPolygon(point, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;
        const intersects = (yi > point.y) !== (yj > point.y) &&
            point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
        if (intersects) inside = !inside;
    }
    return inside;
}

function polygonToCells(polygon) {
    const cleaned = removeCollinear2D(polygon);
    if (cleaned.length < 3) return new Set();

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of cleaned) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
    }

    const startX = Math.floor(minX);
    const endX = Math.ceil(maxX);
    const startY = Math.floor(minY);
    const endY = Math.ceil(maxY);
    const cells = new Set();

    for (let x = startX; x < endX; x++) {
        for (let y = startY; y < endY; y++) {
            const center = new THREE.Vector2(x + 0.5, y + 0.5);
            if (pointInPolygon(center, cleaned)) {
                cells.add(`${x},${y}`);
            }
        }
    }
    return cells;
}

function isOrthogonalPlanePolygon(points, axis) {
    const projected = projectPointsToPlane(points, axis);
    if (projected.length < 2) return false;
    for (let i = 0; i < projected.length; i++) {
        const current = projected[i];
        const next = projected[(i + 1) % projected.length];
        const dx = Math.abs(next.x - current.x);
        const dy = Math.abs(next.y - current.y);
        if (dx <= FACE_EPSILON && dy <= FACE_EPSILON) {
            continue;
        }
        if (dx > FACE_EPSILON && dy > FACE_EPSILON) {
            return false;
        }
    }
    return true;
}

function buildPlaneMesh(axis, value, cells, faceMaterial) {
    if (!cells || cells.size === 0) return null;
    const positions = [];
    const indices = [];
    let index = 0;

    for (const key of cells) {
        const [u, v] = key.split(',').map(Number);
        let p0;
        let p1;
        let p2;
        let p3;

        if (axis === 'x') {
            p0 = [value, u, v];
            p1 = [value, u + 1, v];
            p2 = [value, u + 1, v + 1];
            p3 = [value, u, v + 1];
        } else if (axis === 'y') {
            p0 = [u, value, v];
            p1 = [u + 1, value, v];
            p2 = [u + 1, value, v + 1];
            p3 = [u, value, v + 1];
        } else {
            p0 = [u, v, value];
            p1 = [u + 1, v, value];
            p2 = [u + 1, v + 1, value];
            p3 = [u, v + 1, value];
        }

        positions.push(...p0, ...p1, ...p2, ...p3);
        indices.push(index, index + 1, index + 2, index, index + 2, index + 3);
        index += 4;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return attachFaceOutline(new THREE.Mesh(geometry, faceMaterial));
}

function buildPlaneGridLines(axis, value, cells, gridLineMaterial) {
    if (!cells || cells.size === 0) return null;
    const edgeKeys = new Set();

    const addEdge = (u1, v1, u2, v2) => {
        const key = (u1 < u2 || (u1 === u2 && v1 <= v2))
            ? `${u1},${v1}|${u2},${v2}`
            : `${u2},${v2}|${u1},${v1}`;
        edgeKeys.add(key);
    };

    for (const cellKey of cells) {
        const [u, v] = cellKey.split(',').map(Number);
        addEdge(u, v, u + 1, v);
        addEdge(u + 1, v, u + 1, v + 1);
        addEdge(u + 1, v + 1, u, v + 1);
        addEdge(u, v + 1, u, v);
    }

    const positions = [];
    for (const edgeKey of edgeKeys) {
        const [a, b] = edgeKey.split('|');
        const [u1, v1] = a.split(',').map(Number);
        const [u2, v2] = b.split(',').map(Number);

        let p1;
        let p2;
        if (axis === 'x') {
            p1 = [value, u1, v1];
            p2 = [value, u2, v2];
        } else if (axis === 'y') {
            p1 = [u1, value, v1];
            p2 = [u2, value, v2];
        } else {
            p1 = [u1, v1, value];
            p2 = [u2, v2, value];
        }

        positions.push(...p1, ...p2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const lines = new THREE.LineSegments(geometry, gridLineMaterial);
    lines.renderOrder = 2;
    const offset = 0.002;
    if (axis === 'x') lines.position.x += offset;
    if (axis === 'y') lines.position.y += offset;
    if (axis === 'z') lines.position.z += offset;
    return lines;
}

function computeNewellNormal(points) {
    const normal = new THREE.Vector3();
    for (let i = 0; i < points.length; i++) {
        const current = points[i];
        const next = points[(i + 1) % points.length];
        normal.x += (current.y - next.y) * (current.z + next.z);
        normal.y += (current.z - next.z) * (current.x + next.x);
        normal.z += (current.x - next.x) * (current.y + next.y);
    }
    return normal;
}

function createFaceMesh(points, faceMaterial) {
    if (points.length < 3) return null;

    const cleaned = [];
    for (const point of points) {
        if (cleaned.length === 0 || !pointsEqual(point, cleaned[cleaned.length - 1])) {
            cleaned.push(point.clone());
        }
    }
    if (cleaned.length > 2 && pointsEqual(cleaned[0], cleaned[cleaned.length - 1])) {
        cleaned.pop();
    }
    if (cleaned.length < 3) return null;

    const normal = computeNewellNormal(cleaned);
    if (normal.lengthSq() < 1e-6) return null;
    normal.normalize();

    const origin = cleaned[0];
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, origin);
    for (const point of cleaned) {
        if (Math.abs(plane.distanceToPoint(point)) > FACE_EPSILON * 10) {
            return null;
        }
    }
    const flattened = cleaned.map((point) => plane.projectPoint(point, new THREE.Vector3()));

    let u = flattened[1].clone().sub(origin);
    if (u.lengthSq() < 1e-6) {
        for (let i = 2; i < flattened.length; i++) {
            u = flattened[i].clone().sub(origin);
            if (u.lengthSq() >= 1e-6) break;
        }
    }
    if (u.lengthSq() < 1e-6) return null;
    u.normalize();

    const v = new THREE.Vector3().crossVectors(normal, u).normalize();
    u = new THREE.Vector3().crossVectors(v, normal).normalize();

    const projected = flattened.map((point) => {
        const relative = point.clone().sub(origin);
        return new THREE.Vector2(relative.dot(u), relative.dot(v));
    });

    function removeCollinear(contourPoints, shapePoints) {
        if (contourPoints.length <= 3) {
            return { contour: contourPoints, facePoints: shapePoints };
        }

        const indices = [];
        const count = contourPoints.length;
        const areaEpsilon = 1e-6;
        for (let i = 0; i < count; i++) {
            const prev = contourPoints[(i - 1 + count) % count];
            const current = contourPoints[i];
            const next = contourPoints[(i + 1) % count];
            const area = Math.abs(
                (current.x - prev.x) * (next.y - prev.y) -
                (current.y - prev.y) * (next.x - prev.x)
            );
            if (area > areaEpsilon) {
                indices.push(i);
            }
        }

        if (indices.length < 3) {
            return { contour: contourPoints, facePoints: shapePoints };
        }

        return {
            contour: indices.map((index) => contourPoints[index]),
            facePoints: indices.map((index) => shapePoints[index])
        };
    }

    let contour = projected;
    let facePoints = flattened;
    const simplified = removeCollinear(contour, facePoints);
    contour = simplified.contour;
    facePoints = simplified.facePoints;
    let triangles = THREE.ShapeUtils.triangulateShape(contour, []);
    if (triangles.length === 0) {
        contour = [...projected].reverse();
        facePoints = [...flattened].reverse();
        const simplifiedReversed = removeCollinear(contour, facePoints);
        contour = simplifiedReversed.contour;
        facePoints = simplifiedReversed.facePoints;
        triangles = THREE.ShapeUtils.triangulateShape(contour, []);
    if (triangles.length === 0) return null;
    }

    const vertices = [];
    for (const point of facePoints) {
        vertices.push(point.x, point.y, point.z);
    }

    const indices = [];
    for (const triangle of triangles) {
        indices.push(triangle[0], triangle[1], triangle[2]);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return { mesh: attachFaceOutline(new THREE.Mesh(geometry, faceMaterial)), facePoints };
}

export function createFaceController({
    scene,
    faceMaterial,
    gridLineMaterial,
    faceRegistry,
    planeFill,
    looseFaceVertices,
    looseFaceMeshes,
    entryManager
}) {
    function restorePlaneFill({ axis, value, cells, mesh = null }) {
        const planeKey = getPlaneKey(axis, value);
        const mergedCells = new Set(cells ?? []);
        const prevData = planeFill.get(planeKey);
        if (prevData?.mesh) {
            scene.remove(prevData.mesh);
        }
        if (prevData?.gridLines) {
            scene.remove(prevData.gridLines);
        }

        const nextMesh = mesh ? attachFaceOutline(mesh) : buildPlaneMesh(axis, value, mergedCells, faceMaterial);
        const nextGridLines = buildPlaneGridLines(axis, value, mergedCells, gridLineMaterial);

        if (nextMesh) scene.add(nextMesh);
        if (nextGridLines) scene.add(nextGridLines);

        planeFill.set(planeKey, {
            axis,
            value,
            cells: mergedCells,
            mesh: nextMesh,
            gridLines: nextGridLines,
            boundaryVertexKeys: getBoundaryCornerVertexKeys(axis, value, mergedCells)
        });
        entryManager.updatePlaneVisibility(planeKey);
        return planeKey;
    }

    function restoreLooseFace({ faceKey, faceVertices, mesh = null, points = null, planeKey = '' }) {
        let resolvedFaceKey = faceKey;
        let resolvedVertices = Array.isArray(faceVertices) ? [...faceVertices] : null;
        let resolvedMesh = mesh;

        if (!resolvedMesh && Array.isArray(points)) {
            const faceData = createFaceMesh(points, faceMaterial);
            if (!faceData) return null;
            resolvedMesh = faceData.mesh;
            resolvedVertices = faceData.facePoints.map((point) => getVertexKey(point));
            resolvedFaceKey = resolvedFaceKey ?? buildFaceKey(points, planeKey);
        }

        if (!resolvedMesh || !resolvedFaceKey || !resolvedVertices) {
            return null;
        }

        const previousMesh = looseFaceMeshes?.get(resolvedFaceKey);
        if (previousMesh) {
            scene.remove(previousMesh);
        }

        attachFaceOutline(resolvedMesh);
        scene.add(resolvedMesh);
        looseFaceMeshes.set(resolvedFaceKey, resolvedMesh);
        looseFaceVertices.set(resolvedFaceKey, resolvedVertices);
        faceRegistry.add(resolvedFaceKey);
        return resolvedFaceKey;
    }

    function createPlaneFace(points, planeInfo) {
        const planeKey = getPlaneKey(planeInfo.axis, planeInfo.value);
        const polygon2D = projectPointsToPlane(points, planeInfo.axis);
        const polygonCells = polygonToCells(polygon2D);
        if (polygonCells.size === 0) return null;

        const prevData = planeFill.get(planeKey);
        const prevCells = prevData ? prevData.cells : new Set();
        const mergedCells = new Set(prevCells);
        let changed = false;
        for (const cell of polygonCells) {
            if (!mergedCells.has(cell)) {
                mergedCells.add(cell);
                changed = true;
            }
        }

        if (!changed) {
            entryManager.updatePlaneVisibility(planeKey);
            return { planeUpdate: null, hadFace: true, changed: false, alreadyExists: true };
        }

        const prevMesh = prevData ? prevData.mesh : null;
        const prevGridLines = prevData ? prevData.gridLines : null;
        const nextMesh = buildPlaneMesh(planeInfo.axis, planeInfo.value, mergedCells, faceMaterial);
        const nextGridLines = buildPlaneGridLines(planeInfo.axis, planeInfo.value, mergedCells, gridLineMaterial);
        if (prevMesh) scene.remove(prevMesh);
        if (prevGridLines) scene.remove(prevGridLines);
        if (nextMesh) scene.add(nextMesh);
        if (nextGridLines) scene.add(nextGridLines);
        const prevBoundaryKeys = prevData ? prevData.boundaryVertexKeys : new Set();
        const nextBoundaryKeys = getBoundaryCornerVertexKeys(planeInfo.axis, planeInfo.value, mergedCells);
        planeFill.set(planeKey, {
            axis: planeInfo.axis,
            value: planeInfo.value,
            cells: mergedCells,
            mesh: nextMesh,
            gridLines: nextGridLines,
            boundaryVertexKeys: nextBoundaryKeys
        });
        entryManager.updatePlaneVisibility(planeKey);

        return {
            planeUpdate: {
                planeKey,
                axis: planeInfo.axis,
                value: planeInfo.value,
                prevCells: Array.from(prevCells),
                nextCells: Array.from(mergedCells),
                prevMesh,
                nextMesh,
                prevGridLines,
                nextGridLines,
                prevBoundaryKeys: Array.from(prevBoundaryKeys),
                nextBoundaryKeys: Array.from(nextBoundaryKeys)
            },
            hadFace: true,
            changed: true,
            alreadyExists: false
        };
    }

    function createLooseFace(points, planeKey) {
        const faceKey = buildFaceKey(points, planeKey);
        if (faceRegistry.has(faceKey)) {
            return { face: null, faceKey, hadFace: true, alreadyExists: true };
        }
        const faceData = createFaceMesh(points, faceMaterial);
        if (!faceData) return null;
        scene.add(faceData.mesh);
        if (looseFaceMeshes) {
            looseFaceMeshes.set(faceKey, faceData.mesh);
        }
        faceRegistry.add(faceKey);
        const faceVertices = faceData.facePoints.map((point) => getVertexKey(point));
        looseFaceVertices.set(faceKey, faceVertices);
        return {
            face: faceData.mesh,
            faceKey,
            hadFace: true,
            alreadyExists: false,
            faceVertices
        };
    }

    function processLoopFace(points, planeKeyHint) {
        const planeInfo = getAxisAlignedPlane(points);
        if (planeInfo) {
            if (!isOrthogonalPlanePolygon(points, planeInfo.axis)) {
                const planeKey = getPlaneKey(planeInfo.axis, planeInfo.value);
                return createLooseFace(points, planeKey);
            }
            return createPlaneFace(points, planeInfo);
        }
        return createLooseFace(points, planeKeyHint);
    }

    return {
        processLoopFace,
        restorePlaneFill,
        restoreLooseFace
    };
}
