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
import { exportGLTF, exportOBJ } from './src/export.js';
import { createUvEditor } from './src/uv_editor.js';
import { createWorkspaceModeController } from './src/workspace_mode.js';

const { scene, camera, renderer, controls } = initScene();
const state = createState(scene);
const ui = createUI();
const textureManager = createTextureManager();
const uvEditor = createUvEditor();


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
let selectionManager = null;

const getCurrentTextureScope = () => ui.getTextureTargetScope();
const getCurrentUvSession = () => {
    return selectionManager?.getUvEditorSession?.(
        getCurrentTextureScope(),
        textureManager.getSelectedTexture()
    ) ?? null;
};

const refreshTextureTools = () => {
    textureManager.setQuickApplyAvailable(selectionManager?.hasUvTarget?.('selection') ?? false);

    if (!ui.isTextureManagerVisible()) {
        return;
    }

    const session = getCurrentUvSession();
    if (session) {
        uvEditor.show(session);
    } else {
        uvEditor.hide();
    }
};

const updateUI = () => {
    const hideCursorForBlockModes = state.controlMode === 'blocks-keyboard' || state.controlMode === 'blocks-mouse';
    const showAllPoints = state.showVertices || state.controlMode === 'points' || state.workMode === 'blueprint';
    const visibleVertices = showAllPoints
        ? new Set(state.vertexPositions.keys())
        : computeVisibleVertices(state);
    state.cursorMesh.visible = !hideCursorForBlockModes;
    entryManager.applyLooseFaceVisibility(state.looseFaceVertices);
    entryManager.applyVisibleVertices(visibleVertices, showAllPoints, state.showVertices);
    ui.setClearPointSelectionEnabled((state.controlMode === 'lines' || state.workMode === 'blueprint') && state.selectedPointKeys.length > 0);
    ui.setMergeSelectedBlocksEnabled((blockManager?.getSelectedEntries?.().length ?? 0) > 1);
    ui.setVertexVisibility(state.showVertices);
    ui.update({ position: state.currentPosition, stats: computeStats(state, entryManager, visibleVertices, blockManager) });
    refreshTextureTools();
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

ui.onMergeBlocks(() => {
    if (!blockManager) return;

    const result = blockManager.mergeAllEntriesIntoComposite();
    if (!result.changed) {
        alert('No se encontraron grupos de bloques compatibles para fusionar sin caras internas.');
        return;
    }

    selectionManager?.clearSelection();
    undoManager.pushAction({
        kind: 'block-merge',
        removedEntries: result.removedEntries,
        createdEntries: result.createdEntries
    });
    updateUI();

    alert(`Fusion completada: ${result.beforeCount} bloques -> ${result.afterCount} figuras sin caras internas.`);
});

ui.onMergeSelectedBlocks(() => {
    if (!blockManager) return;

    const selectedEntries = blockManager.getSelectedEntries();
    if (selectedEntries.length < 2) {
        alert('Selecciona al menos dos bloques en modo "Bloques (teclado)". Usa Mayus + clic para acumular seleccion.');
        return;
    }

    const result = blockManager.mergeEntriesIntoComposite(selectedEntries);
    if (!result.changed) {
        const hasUnsupportedEntries = (result.rejectedEntries?.length ?? 0) > 0;
        alert(
            hasUnsupportedEntries
                ? 'La fusion por seleccion solo funciona con figuras cubicas alineadas a la misma rejilla y sin texturas por cara.'
                : 'No se pudo crear una figura compuesta con la seleccion actual.'
        );
        return;
    }

    selectionManager?.clearSelection();
    if ((result.resultingEntries?.length ?? 0) > 0) {
        const primaryEntry = result.resultingEntries[result.resultingEntries.length - 1];
        blockManager.setSelection(result.resultingEntries, primaryEntry);
        state.currentPosition.copy(primaryEntry.position);
        state.cursorMesh.position.copy(state.currentPosition);
        state.pathPoints = [state.currentPosition.clone()];
    }

    undoManager.pushAction({
        kind: 'block-merge',
        removedEntries: result.removedEntries,
        createdEntries: result.createdEntries
    });
    updateUI();

    alert(`Fusion completada: ${selectedEntries.length} figuras seleccionadas -> ${result.resultingEntries.length} figuras.`);
});

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

selectionManager = attachSelection({
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

const workspaceModeController = createWorkspaceModeController({
    scene,
    camera,
    renderer,
    controls,
    state,
    entryManager,
    faceController,
    graphManager,
    blockManager,
    undoManager,
    onUpdate: updateUI
});

attachBlockContextMenu({
    scene,
    camera,
    renderer,
    controls,
    state,
    blockManager,
    undoManager,
    onUpdate: updateUI
});

ui.onControlModeChange((mode) => {
    state.controlMode = mode;
    selectionManager.clearSelection();
    state.pathPoints = [state.currentPosition.clone()];
    updateUI();
});
ui.onVertexVisibilityChange((visible) => {
    state.showVertices = visible;
    updateUI();
});
ui.setControlMode(state.controlMode);
ui.setWorkMode(state.workMode);
ui.setVertexVisibility(state.showVertices);
ui.setTextureTargetScope('selection');

ui.onWorkModeToggle((mode) => {
    selectionManager.clearSelection();
    workspaceModeController.setMode(mode);
    ui.setWorkMode(mode);
    updateUI();
});

ui.onGeometryChange((type) => {
    state.currentGeometryType = type;
});

textureManager.onApply((texture) => {
    selectionManager.applyTexture(getCurrentTextureScope(), texture);
    refreshTextureTools();
});
textureManager.onQuickApply((texture) => {
    selectionManager.applyTexture('selection', texture);
    refreshTextureTools();
});
textureManager.onSelectionChange(() => {
    refreshTextureTools();
});

ui.onOpenUvEditor(() => {
    const nextVisible = !ui.isTextureManagerVisible();
    ui.showTextureManager(nextVisible);
    if (!nextVisible) {
        uvEditor.hide();
        return;
    }
    const session = getCurrentUvSession();
    if (session) {
        uvEditor.show(session);
    } else {
        uvEditor.hide();
    }
    refreshTextureTools();
});

ui.onTextureTargetScopeChange(() => {
    if (!ui.isTextureManagerVisible()) return;
    refreshTextureTools();
});

ui.onExportGLTF(() => {
    exportGLTF(state, blockManager);
});

ui.onExportOBJ(() => {
    exportOBJ(state, blockManager);
});

function animate() {
    requestAnimationFrame(animate);
    if (state.workMode === 'classic') {
        controls.update();
    }
    if (!workspaceModeController.render()) {
        renderer.render(scene, camera);
    }
}

updateUI();
animate();
startHeartbeat();
