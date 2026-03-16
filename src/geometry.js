import * as THREE from 'three';
import { POSITION_EPSILON, FACE_EPSILON } from './constants.js';

const WORLD_AXES = [
    { dir: new THREE.Vector3(1, 0, 0), name: 'X' },
    { dir: new THREE.Vector3(-1, 0, 0), name: '-X' },
    { dir: new THREE.Vector3(0, 1, 0), name: 'Y' },
    { dir: new THREE.Vector3(0, -1, 0), name: '-Y' },
    { dir: new THREE.Vector3(0, 0, 1), name: 'Z' },
    { dir: new THREE.Vector3(0, 0, -1), name: '-Z' }
];

export function getBestAxis(cameraVector) {
    let maxDot = -Infinity;
    let bestAxis = null;
    for (const axis of WORLD_AXES) {
        const dot = cameraVector.dot(axis.dir);
        if (dot > maxDot) {
            maxDot = dot;
            bestAxis = axis.dir.clone();
        }
    }
    return bestAxis;
}

export function pointsEqual(a, b) {
    return a.distanceToSquared(b) < POSITION_EPSILON * POSITION_EPSILON;
}

export function roundCoord(value) {
    const rounded = Math.round(value * 1000) / 1000;
    return Math.abs(rounded) < 1e-6 ? 0 : rounded;
}

export function getVertexKey(point) {
    return `${roundCoord(point.x)},${roundCoord(point.y)},${roundCoord(point.z)}`;
}

export function ensureVertex(vertexPositions, point) {
    const key = getVertexKey(point);
    if (!vertexPositions.has(key)) {
        vertexPositions.set(key, point.clone());
    }
    return key;
}

export function getPlaneKey(axis, value) {
    return `${axis}:${roundCoord(value)}`;
}

export function getEdgePlaneCandidates(start, end) {
    const planes = [];
    const dx = Math.abs(start.x - end.x);
    const dy = Math.abs(start.y - end.y);
    const dz = Math.abs(start.z - end.z);

    if (dx > FACE_EPSILON) {
        planes.push({ axis: 'y', value: start.y });
        planes.push({ axis: 'z', value: start.z });
    } else if (dy > FACE_EPSILON) {
        planes.push({ axis: 'x', value: start.x });
        planes.push({ axis: 'z', value: start.z });
    } else if (dz > FACE_EPSILON) {
        planes.push({ axis: 'x', value: start.x });
        planes.push({ axis: 'y', value: start.y });
    }

    return planes;
}

export function projectPointsToPlane(points, axis) {
    return points.map((point) => {
        if (axis === 'x') return new THREE.Vector2(point.y, point.z);
        if (axis === 'y') return new THREE.Vector2(point.x, point.z);
        return new THREE.Vector2(point.x, point.y);
    });
}

export function getAxisAlignedPlane(points) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const point of points) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
        minZ = Math.min(minZ, point.z);
        maxZ = Math.max(maxZ, point.z);
    }

    const rangeX = maxX - minX;
    const rangeY = maxY - minY;
    const rangeZ = maxZ - minZ;

    if (rangeX <= FACE_EPSILON) {
        return { axis: 'x', value: minX };
    }
    if (rangeY <= FACE_EPSILON) {
        return { axis: 'y', value: minY };
    }
    if (rangeZ <= FACE_EPSILON) {
        return { axis: 'z', value: minZ };
    }
    return null;
}

export function findLoopStartIndex(points, newPoint) {
    for (let i = points.length - 2; i >= 0; i--) {
        if (pointsEqual(points[i], newPoint)) {
            return i;
        }
    }
    return -1;
}

export function buildFaceKey(points, planeKey) {
    const keys = [];
    for (const point of points) {
        keys.push(getVertexKey(point));
    }
    keys.sort();
    const planePart = planeKey ?? 'plane:free';
    return `${planePart}|${keys.join('|')}`;
}
