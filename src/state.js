import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { COLORS } from './constants.js';

export function createState(scene) {
    const lineMaterial = new THREE.LineBasicMaterial({
        color: COLORS.line,
        depthTest: false,
        depthWrite: false
    });
    const pointMaterial = new THREE.MeshBasicMaterial({ color: COLORS.point, depthTest: false });
    const cursorMaterial = new THREE.MeshBasicMaterial({ color: COLORS.point, depthTest: false });
    const gridLineMaterial = new THREE.LineBasicMaterial({
        color: 0x9a9a9a,
        transparent: true,
        opacity: 0.6,
        depthWrite: false
    });
    const faceMaterial = new THREE.MeshStandardMaterial({
        color: COLORS.face,
        roughness: 0.85,
        metalness: 0.0,
        transparent: false,
        opacity: 1.0,
        side: THREE.DoubleSide,
        depthWrite: true,
        polygonOffset: true,
        polygonOffsetFactor: -0.5,
        polygonOffsetUnits: -0.5
    });
    const blockMaterial = new THREE.MeshStandardMaterial({
        color: COLORS.face,
        roughness: 0.7,
        metalness: 0.0
    });

    const pointGeometry = new THREE.SphereGeometry(0.05, 12, 12);
    const cursorGeometry = new THREE.SphereGeometry(0.02, 12, 12);

    function prepareGeometry(geometry) {
        const prepared = mergeVertices(geometry.clone());
        prepared.computeVertexNormals();
        prepared.computeBoundingSphere();
        prepared.computeBoundingBox();
        return prepared;
    }

    // Geometry dictionary for inventory
    const geometries = {
        cube: prepareGeometry(new THREE.BoxGeometry(1, 1, 1)),
        sphere: prepareGeometry(new THREE.SphereGeometry(0.5, 32, 24)),
        cylinder: prepareGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 32, 16)),
        pyramid: prepareGeometry(new THREE.ConeGeometry(0.707, 1, 4, 12)), // 0.707 radius fits closely in 1x1x1
        cone: prepareGeometry(new THREE.ConeGeometry(0.5, 1, 32, 16))
    };

    // Default to cube for retrocompatibility
    const blockGeometry = geometries.cube;

    const currentPosition = new THREE.Vector3(0, 0, 0);

    const cursorMesh = new THREE.Mesh(cursorGeometry, cursorMaterial);
    cursorMesh.renderOrder = 2;
    cursorMesh.position.copy(currentPosition);
    scene.add(cursorMesh);

    const originPoint = new THREE.Mesh(pointGeometry, pointMaterial.clone());
    originPoint.position.copy(currentPosition);
    originPoint.renderOrder = 2;

    return {
        lineMaterial,
        pointMaterial,
        cursorMaterial,
        gridLineMaterial,
        faceMaterial,
        blockMaterial,
        pointGeometry,
        cursorGeometry,
        blockGeometry,
        geometries,
        currentPosition,
        cursorMesh,
        originPoint,
        drawingPoints: [currentPosition.clone()],
        pathPoints: [currentPosition.clone()],
        undoStack: [],
        redoStack: [],
        planeGraphs: new Map(),
        faceRegistry: new Set(),
        vertexPositions: new Map(),
        planeFill: new Map(),
        looseFaceVertices: new Map(),
        looseFaceMeshes: new Map(),
        selectedEntry: null,
        selectedPointKeys: [],
        hoveredEntry: null,
        workMode: 'classic',
        controlMode: 'lines',
        selectedBlock: null,
        selectedBlocks: [],
        hoveredBlock: null,
        hoveredFace: null,
        selectedFace: null,
        currentBlockSize: 1,
        currentGeometryType: 'cube'
    };
}
