import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

const canvasWrap = document.getElementById('viewer-canvas-wrap');
const fileInput = document.getElementById('model-file-input');
const loadButton = document.getElementById('load-model-button');
const statusLabel = document.getElementById('viewer-status');
const formatLabel = document.getElementById('viewer-format');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1b2128);
scene.fog = new THREE.Fog(0x1b2128, 18, 60);

const camera = new THREE.PerspectiveCamera(52, 1, 0.01, 500);
camera.position.set(3.4, 2.8, 5.2);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
canvasWrap.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.8, 0);

const ambientLight = new THREE.HemisphereLight(0xffffff, 0x4d5560, 1.25);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(4, 6, 5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xa8c3ff, 0.45);
fillLight.position.set(-4, 2, -3);
scene.add(fillLight);

const grid = new THREE.GridHelper(20, 20, 0x3a4552, 0x28303a);
grid.position.y = -0.001;
scene.add(grid);

const axes = new THREE.AxesHelper(0.8);
axes.position.set(-4.2, 0.01, 4.2);
scene.add(axes);

let currentModel = null;

function setStatus(message, formatText = formatLabel.textContent) {
  statusLabel.textContent = message;
  formatLabel.textContent = formatText;
}

function resizeRenderer() {
  const width = Math.max(canvasWrap.clientWidth, 1);
  const height = Math.max(canvasWrap.clientHeight, 1);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function disposeMaterial(material) {
  if (!material) return;
  material.map?.dispose?.();
  material.dispose?.();
}

function clearCurrentModel() {
  if (!currentModel) return;
  scene.remove(currentModel);
  currentModel.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach(disposeMaterial);
    } else {
      disposeMaterial(child.material);
    }
  });
  currentModel = null;
}

function ensureRenderableMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => {
        if (material?.colorSpace === undefined) return;
      });
      return;
    }
    if (!child.material) {
      child.material = new THREE.MeshStandardMaterial({ color: 0xbfc5cd });
    }
  });
}

function frameObject(object) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 0.5);

  object.position.sub(center);
  object.updateMatrixWorld(true);

  const distance = maxDimension * 1.6;
  camera.position.set(distance, distance * 0.82, distance * 1.15);
  camera.near = Math.max(maxDimension / 500, 0.01);
  camera.far = Math.max(maxDimension * 30, 200);
  camera.updateProjectionMatrix();
  controls.target.set(0, Math.max(size.y * 0.12, 0), 0);
  controls.update();
}

function wrapGeometryAsMesh(geometry, color = 0xc5ccd5) {
  if (!geometry.getAttribute('normal')) {
    geometry.computeVertexNormals();
  }
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.86,
    metalness: 0.04
  });
  return new THREE.Mesh(geometry, material);
}

async function loadModelFromFile(file) {
  if (!file) return;

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const commonStatus = `${file.name} · ${extension.toUpperCase() || 'desconocido'}`;

  setStatus('Cargando modelo...', commonStatus);

  let root = null;
  try {
    if (extension === 'glb' || extension === 'gltf') {
      const loader = new GLTFLoader();
      const source = extension === 'gltf' ? await file.text() : await file.arrayBuffer();
      const gltf = await new Promise((resolve, reject) => {
        loader.parse(source, '', resolve, reject);
      });
      root = gltf.scene || gltf.scenes?.[0] || null;
    } else if (extension === 'obj') {
      const loader = new OBJLoader();
      root = loader.parse(await file.text());
    } else if (extension === 'fbx') {
      const loader = new FBXLoader();
      root = loader.parse(await file.arrayBuffer(), '');
    } else if (extension === 'stl') {
      const loader = new STLLoader();
      const geometry = loader.parse(await file.arrayBuffer());
      root = wrapGeometryAsMesh(geometry, 0xc1c7cf);
    } else if (extension === 'ply') {
      const loader = new PLYLoader();
      const geometry = loader.parse(await file.arrayBuffer());
      root = wrapGeometryAsMesh(geometry, 0xbfc5cd);
    } else {
      throw new Error('Formato no soportado en este visor.');
    }

    if (!root) {
      throw new Error('No se pudo construir la escena del modelo.');
    }

    clearCurrentModel();
    currentModel = new THREE.Group();
    currentModel.add(root);
    ensureRenderableMaterials(currentModel);
    scene.add(currentModel);
    frameObject(currentModel);

    setStatus('Modelo cargado correctamente.', commonStatus);
  } catch (error) {
    console.error('Error al cargar modelo:', error);
    clearCurrentModel();
    setStatus(error.message || 'No se pudo cargar el modelo.', commonStatus);
  }
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

loadButton.addEventListener('click', () => {
  fileInput.value = '';
  fileInput.click();
});

fileInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  await loadModelFromFile(file);
});

window.addEventListener('resize', resizeRenderer);
resizeRenderer();
animate();
