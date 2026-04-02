import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function initScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x262b31);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(10, 10, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const gridHelper = new THREE.GridHelper(50, 50, 0x5b6470, 0x3c434d);
    gridHelper.position.y = -0.01;
    if (gridHelper.material) {
        const materials = Array.isArray(gridHelper.material) ? gridHelper.material : [gridHelper.material];
        for (const material of materials) {
            material.transparent = true;
            material.opacity = 0.42;
            material.depthWrite = false;
        }
    }
    scene.add(gridHelper);

    const hemisphereLight = new THREE.HemisphereLight(0xbfc9d9, 0x1b1d22, 0.85);
    scene.add(hemisphereLight);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.38);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xf5f7fb, 1.05);
    directionalLight.position.set(12, 18, 10);
    scene.add(directionalLight);

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', onWindowResize, false);

    return { scene, camera, renderer, controls };
}
