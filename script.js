import { initScene } from './src/scene.js';
import { createState } from './src/state.js';
import { createUI } from './src/ui.js';
import { createEntryManager } from './src/entries.js';
import { createBlockManager } from './src/blocks.js';
import { createGraphManager } from './src/graph.js';
import { createFaceController } from './src/faces.js';
import { createUndoManager } from './src/undo.js';
import { attachKeyboardControls } from './src/input.js';
import { startHeartbeat } from './src/heartbeat.js';
import { ensureVertex } from './src/geometry.js';
import { computeStats, computeVisibleVertices } from './src/stats.js';
import { attachSelection } from './src/selection.js';
import { attachMouseBlockControls } from './src/mouse_blocks.js';
import { attachBlockContextMenu } from './src/block_context.js';
import { createCleanupManager } from './src/cleanup.js';
import { createTextureManager } from './src/textures.js';

const { scene, camera, renderer, controls } = initScene();
const state = createState(scene);
const ui = createUI();
const textureManager = createTextureManager();


const entryManager = createEntryManager(scene, state.planeFill);
const blockManager = createBlockManager({ scene, state, entryManager });
const graphManager = createGraphManager(state.planeGraphs);
const faceController = createFaceController({
    scene,
    faceMaterial: state.faceMaterial,
    gridLineMaterial: state.gridLineMaterial,
    faceRegistry: state.faceRegistry,
    planeFill: state.planeFill,
    looseFaceVertices: state.looseFaceVertices,
    looseFaceMeshes: state.looseFaceMeshes,
    entryManager
});
const updateUI = () => {
    const visibleVertices = state.controlMode === 'points'
        ? new Set(state.vertexPositions.keys())
        : computeVisibleVertices(state);
    entryManager.applyLooseFaceVisibility(state.looseFaceVertices);
    entryManager.applyVisibleVertices(visibleVertices, state.controlMode === 'points');
    ui.setClearPointSelectionEnabled(state.controlMode === 'lines' && state.selectedPointKeys.length > 0);
    ui.update({ position: state.currentPosition, stats: computeStats(state, entryManager, visibleVertices) });
};

const undoManager = createUndoManager({
    scene,
    state,
    entryManager,
    blockManager,
    graphManager,
    onUpdate: updateUI
});

const cleanupManager = createCleanupManager({
    state,
    entryManager,
    graphManager,
    undoManager,
    onUpdate: updateUI
});

ui.onCleanupLines(() => cleanupManager.removeLinesWithoutFace());

const originKey = ensureVertex(state.vertexPositions, state.originPoint.position);
entryManager.registerPointEntry(state.originPoint, state.originPoint.position, originKey);

attachKeyboardControls({
    scene,
    state,
    camera,
    entryManager,
    faceController,
    graphManager,
    blockManager,
    undoManager,
    onUpdate: updateUI
});

const selectionManager = attachSelection({
    camera,
    renderer,
    entryManager,
    blockManager,
    state,
    onUpdate: updateUI,
    scene,
    graphManager,
    faceController,
    undoManager
});

ui.onClearPointSelection(() => selectionManager.clearPointSelection());

attachMouseBlockControls({
    camera,
    renderer,
    state,
    blockManager,
    undoManager,
    onUpdate: updateUI
});

attachBlockContextMenu({
    camera,
    renderer,
    state,
    blockManager,
    undoManager,
    onUpdate: updateUI
});

ui.onControlModeChange((mode) => {
    state.controlMode = mode;
    selectionManager.clearSelection();
    state.pathPoints = [state.currentPosition.clone()];
    ui.showTextureManager(mode === 'select-face');
    updateUI();
});
ui.setControlMode(state.controlMode);

textureManager.onApply((texture) => {
    selectionManager.applyTextureToSelected(texture);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

updateUI();
animate();
startHeartbeat();
