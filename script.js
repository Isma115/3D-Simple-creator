import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);
// Add subtle fog to blend the horizon
scene.fog = new THREE.Fog(0x1a1a1a, 20, 80);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Initial camera position (looking sort of from an isometric angle)
camera.position.set(10, 10, 10);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // optimize pixel ratio
document.body.appendChild(renderer.domElement);

// --- Controls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // smooth rotation
controls.dampingFactor = 0.05;

// --- Guides and Helpers ---
// Grid
const gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
gridHelper.position.y = -0.01; // slightly below 0 to avoid z-fighting with lines
scene.add(gridHelper);

// Axes (X = red, Y = green, Z = blue)
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// Optional: Subtle lighting just in case we add 3D objects instead of basic lines
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);


// --- Drawing State Setup ---
// The current position of the drawing cursor
let currentPosition = new THREE.Vector3(0, 0, 0);

// Visual Cursor (a small sphere showing where we are)
const cursorGeometry = new THREE.SphereGeometry(0.2, 16, 16);
const cursorMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff87 });
const cursorMesh = new THREE.Mesh(cursorGeometry, cursorMaterial);
scene.add(cursorMesh);

// We will store all the points here to potentially draw later or save
let drawingPoints = [currentPosition.clone()];
let currentLineColor = 0x60efff;


// UI Elements
const coordsDisplay = document.getElementById('coordinates-display');

function updateUI() {
    coordsDisplay.textContent = `X: ${currentPosition.x.toFixed(1)}, Y: ${currentPosition.y.toFixed(1)}, Z: ${currentPosition.z.toFixed(1)}`;
}

// --- Handling Window Resize ---
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- Drawing Logic Setup ---

const worldAxes = [
    { dir: new THREE.Vector3(1, 0, 0), name: 'X' },
    { dir: new THREE.Vector3(-1, 0, 0), name: '-X' },
    { dir: new THREE.Vector3(0, 1, 0), name: 'Y' },
    { dir: new THREE.Vector3(0, -1, 0), name: '-Y' },
    { dir: new THREE.Vector3(0, 0, 1), name: 'Z' },
    { dir: new THREE.Vector3(0, 0, -1), name: '-Z' }
];

function getBestAxis(cameraVector) {
    let maxDot = -Infinity;
    let bestAxis = null;
    for (const axis of worldAxes) {
        const dot = cameraVector.dot(axis.dir);
        if (dot > maxDot) {
            maxDot = dot;
            bestAxis = axis.dir.clone();
        }
    }
    return bestAxis;
}

window.addEventListener('keydown', (event) => {
    // We only care about Arrow keys
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    
    // Prevent default scrolling when using arrow keys
    event.preventDefault();

    // Get the camera's local right and up vectors in world space
    const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
    
    let moveVector;

    switch (event.key) {
        case 'ArrowUp':
            moveVector = getBestAxis(cameraUp);
            break;
        case 'ArrowDown':
            moveVector = getBestAxis(cameraUp.clone().negate());
            break;
        case 'ArrowRight':
            moveVector = getBestAxis(cameraRight);
            break;
        case 'ArrowLeft':
            moveVector = getBestAxis(cameraRight.clone().negate());
            break;
    }

    // Move current position by 1 unit
    const step = 1; 
    const startPoint = currentPosition.clone();
    currentPosition.add(moveVector.multiplyScalar(step));
    
    // Update visual cursor position
    cursorMesh.position.copy(currentPosition);

    // Draw Line
    const material = new THREE.LineBasicMaterial({ color: currentLineColor, depthTest: false });
    const geometry = new THREE.BufferGeometry().setFromPoints([startPoint, currentPosition.clone()]);
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 1; // render on top
    scene.add(line);
    
    // Store point
    drawingPoints.push(currentPosition.clone());
    
    updateUI();
});

// --- Animation Loop ---
function animate() {
    requestAnimationFrame(animate);
    
    // Smoothly update controls
    controls.update();

    renderer.render(scene, camera);
}

// Start app
updateUI();
animate();

// --- Server Lifespan Management ---
// Enviar peticiones periódicas para mantener el servidor vivo
setInterval(() => {
    fetch('/heartbeat').catch(() => {});
}, 2000);

// Intentar apagar el servidor inmediatamente al cerrar la pestaña
window.addEventListener('beforeunload', () => {
    navigator.sendBeacon('/shutdown');
});
