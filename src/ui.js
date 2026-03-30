export function createUI() {
    const urlParams = new URLSearchParams(window.location.search);
    const hasNativeMenus = urlParams.get('nativeMenus') === '1';
    const uiOverlay = document.getElementById('ui-overlay');
    const coordsDisplay = document.getElementById('coordinates-display');
    const geometryDisplay = document.getElementById('active-geometry-display');
    const fpsPanel = document.getElementById('fps-panel');
    const fpsDisplay = document.getElementById('fps-display');
    const fileMenuButton = document.getElementById('file-menu-btn');
    const fileMenu = document.getElementById('file-menu');
    const inventoryMenuButton = document.getElementById('inventory-menu-btn');
    const inventoryMenu = document.getElementById('inventory-menu');
    const editMenuButton = document.getElementById('edit-menu-btn');
    const editMenu = document.getElementById('edit-menu');
    const viewMenuButton = document.getElementById('view-menu-btn');
    const viewMenu = document.getElementById('view-menu');
    const cleanupButton = document.getElementById('cleanup-lines-button');
    const mergeBlocksButton = document.getElementById('merge-blocks-button');
    const mergeSelectedBlocksButton = document.getElementById('merge-selected-blocks-button');
    const toggleEditorHelpButton = document.getElementById('toggle-editor-help-btn');
    const toggleFpsButton = document.getElementById('toggle-fps-btn');
    const controlModeInputs = Array.from(document.querySelectorAll('input[name="control-mode"]'));
    const controlModeToast = document.getElementById('control-mode-toast');
    const controlModeToastValue = document.getElementById('control-mode-toast-value');
    const editorHelpPanel = document.getElementById('editor-help-panel');
    const editorHelpModeTitle = document.getElementById('editor-help-mode-title');
    const editorHelpModeShortcuts = document.getElementById('editor-help-mode-shortcuts');
    const faceNeighborControls = document.getElementById('face-neighbor-controls');
    const faceNeighborDepthInput = document.getElementById('face-neighbor-depth-input');
    const geometryInputs = Array.from(document.querySelectorAll('input[name="geometry-type"]'));
    const geometryInventory = document.getElementById('geometry-inventory');
    const saveProjectButton = document.getElementById('save-project-button');
    const loadProjectButton = document.getElementById('load-project-button');
    const exportGltfButton = document.getElementById('export-gltf-btn');
    const exportObjButton = document.getElementById('export-obj-btn');
    const importObjButton = document.getElementById('import-obj-button');
    const importFbxButton = document.getElementById('import-fbx-button');
    const modelImportInput = document.getElementById('model-import-input');
    const projectImportInput = document.getElementById('project-import-input');
    const openUvEditorButton = document.getElementById('open-uv-editor-btn');
    const textureScopeInputs = Array.from(document.querySelectorAll('input[name="texture-target-scope"]'));
    const textureModal = document.getElementById('texture-modal');
    const closeTextureModalButton = document.getElementById('close-texture-modal-btn');

    let controlModeChangeHandler = null;
    let controlModeToastHideTimer = null;
    let nativeMenuActionHandler = null;
    let modelImportHandler = null;
    let projectImportHandler = null;
    let fpsVisible = false;
    let editorHelpVisible = editorHelpPanel ? !editorHelpPanel.hidden : false;

    const controlModeLabels = new Map(controlModeInputs.map((input) => {
        const label = input.closest('label')?.querySelector('span')?.textContent?.trim() ?? input.value;
        return [input.value, label];
    }));
    const geometryLabels = {
        cube: 'Cubo',
        sphere: 'Esfera',
        cylinder: 'Cilindro',
        pyramid: 'Piramide',
        cone: 'Cono'
    };
    const controlModeHelp = {
        lines: [
            'Click: trazar',
            'Shift + click: sumar',
            'Click der.: unir'
        ],
        'blocks-keyboard': [
            'WASD: mover cursor',
            'Flechas: construir',
            'Ctrl + D: dividir'
        ],
        'blocks-mouse': [
            'Click der.: colocar',
            'Click izq.: borrar',
            'Ctrl + D: dividir'
        ],
        'select-face': [
            'Click: elegir',
            'Shift + click: sumar',
            'Aplicar: textura'
        ],
        'select-face-neighbors': [
            'Click: cara base',
            'Caja: vecinas',
            'Aplicar: textura'
        ]
    };

    if (hasNativeMenus) {
        document.body.dataset.nativeMenus = 'true';
    }

    const menus = [
        { button: fileMenuButton, panel: fileMenu },
        { button: editMenuButton, panel: editMenu },
        { button: inventoryMenuButton, panel: inventoryMenu },
        { button: viewMenuButton, panel: viewMenu }
    ].filter(({ button, panel }) => button && panel);

    function setMenuOpen(button, panel, open) {
        panel.hidden = !open;
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        const group = button.closest('.menu-group');
        if (group) {
            group.dataset.open = open ? 'true' : 'false';
        }
    }

    function closeAllMenus() {
        for (const menu of menus) {
            setMenuOpen(menu.button, menu.panel, false);
        }
    }

    function toggleMenu(button, panel) {
        const willOpen = panel.hidden;
        closeAllMenus();
        setMenuOpen(button, panel, willOpen);
    }

    function update({ position }) {
        if (!coordsDisplay || !position) return;
        coordsDisplay.textContent = `X: ${position.x.toFixed(1)}, Y: ${position.y.toFixed(1)}, Z: ${position.z.toFixed(1)}`;
    }

    function openModelImportDialog(format) {
        if (!modelImportInput) return;
        modelImportInput.dataset.format = format;
        modelImportInput.accept = format === 'fbx' ? '.fbx' : '.obj';
        modelImportInput.value = '';
        modelImportInput.click();
    }

    function openProjectImportDialog() {
        if (!projectImportInput) return;
        projectImportInput.value = '';
        projectImportInput.click();
    }

    function bindMenuAction(button, callback) {
        if (!button) return;
        button.addEventListener('click', () => {
            closeAllMenus();
            callback();
        });
    }

    for (const { button, panel } of menus) {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleMenu(button, panel);
        });

        panel.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }

    document.addEventListener('pointerdown', (event) => {
        if (event.target.closest('.menu-group')) return;
        closeAllMenus();
    });

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeAllMenus();
        }
    });

    if (geometryInventory) {
        geometryInventory.addEventListener('change', () => {
            closeAllMenus();
        });
    }

    if (importObjButton) {
        bindMenuAction(importObjButton, () => openModelImportDialog('obj'));
    }

    if (importFbxButton) {
        bindMenuAction(importFbxButton, () => openModelImportDialog('fbx'));
    }

    if (modelImportInput) {
        modelImportInput.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            const format = modelImportInput.dataset.format ?? file?.name?.split('.').pop()?.toLowerCase() ?? '';
            if (file && modelImportHandler) {
                modelImportHandler({ file, format });
            }
            modelImportInput.value = '';
        });
    }

    if (projectImportInput) {
        projectImportInput.addEventListener('change', (event) => {
            const file = event.target.files?.[0];
            if (file && projectImportHandler) {
                projectImportHandler({ file });
            }
            projectImportInput.value = '';
        });
    }

    function onCleanupLines(handler) {
        bindMenuAction(cleanupButton, handler);
    }

    function onNativeMenuAction(handler) {
        nativeMenuActionHandler = handler;
    }

    function onMergeBlocks(handler) {
        bindMenuAction(mergeBlocksButton, handler);
    }

    function onMergeSelectedBlocks(handler) {
        bindMenuAction(mergeSelectedBlocksButton, handler);
    }

    function onControlModeChange(handler) {
        controlModeChangeHandler = handler;
        for (const input of controlModeInputs) {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                setControlMode(input.value);
                handler(input.value);
            });
        }
    }

    function getControlModeLabel(value) {
        return controlModeLabels.get(value) ?? value;
    }

    function hideControlModeToast() {
        if (!controlModeToast) return;
        controlModeToast.classList.remove('visible');
        controlModeToast.setAttribute('aria-hidden', 'true');
    }

    function showControlModeToast(value) {
        if (!controlModeToast || !controlModeToastValue) return;
        controlModeToastValue.textContent = getControlModeLabel(value);
        controlModeToast.classList.add('visible');
        controlModeToast.setAttribute('aria-hidden', 'false');
        if (controlModeToastHideTimer) {
            clearTimeout(controlModeToastHideTimer);
        }
        controlModeToastHideTimer = window.setTimeout(() => {
            hideControlModeToast();
            controlModeToastHideTimer = null;
        }, 1500);
    }

    function getActiveControlModeIndex() {
        const activeIndex = controlModeInputs.findIndex((input) => input.checked);
        return activeIndex >= 0 ? activeIndex : 0;
    }

    function cycleControlMode(step) {
        if (controlModeInputs.length === 0 || !controlModeChangeHandler) return;
        const currentIndex = getActiveControlModeIndex();
        const nextIndex = (currentIndex + step + controlModeInputs.length) % controlModeInputs.length;
        const nextInput = controlModeInputs[nextIndex];
        if (!nextInput) return;
        nextInput.checked = true;
        setControlMode(nextInput.value);
        controlModeChangeHandler(nextInput.value);
        showControlModeToast(nextInput.value);
    }

    function getWheelStep(event) {
        const legacyDelta = typeof event.wheelDeltaY === 'number'
            ? event.wheelDeltaY
            : typeof event.wheelDelta === 'number'
                ? event.wheelDelta
                : null;

        if (legacyDelta && legacyDelta !== 0) {
            return legacyDelta > 0 ? -1 : 1;
        }

        const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
            ? event.deltaY
            : event.deltaX;

        if (dominantDelta === 0) return 0;
        return dominantDelta > 0 ? 1 : -1;
    }

    function setControlMode(value) {
        for (const input of controlModeInputs) {
            input.checked = input.value === value;
        }
        if (faceNeighborControls) {
            const showNeighborControls = value === 'select-face-neighbors';
            faceNeighborControls.hidden = !showNeighborControls;
        }
        if (editorHelpModeTitle) {
            editorHelpModeTitle.textContent = getControlModeLabel(value);
        }
        if (editorHelpModeShortcuts) {
            const shortcuts = controlModeHelp[value] ?? [];
            editorHelpModeShortcuts.innerHTML = shortcuts.map((shortcut) => `
                <div class="help-line">${shortcut}</div>
            `).join('');
        }
    }

    function showTextureManager(show) {
        if (textureModal) {
            textureModal.style.display = show ? 'flex' : 'none';
        }
    }

    function isTextureManagerVisible() {
        return textureModal ? textureModal.style.display !== 'none' : false;
    }

    function setMergeSelectedBlocksEnabled(enabled) {
        if (!mergeSelectedBlocksButton) return;
        mergeSelectedBlocksButton.disabled = !enabled;
    }

    function setGeometry(value) {
        if (geometryDisplay) {
            geometryDisplay.textContent = geometryLabels[value] ?? value;
        }
        for (const input of geometryInputs) {
            input.checked = input.value === value;
        }
    }

    function setEditorHelpVisibility(visible) {
        editorHelpVisible = visible;
        if (editorHelpPanel) {
            editorHelpPanel.hidden = !visible;
            editorHelpPanel.setAttribute('aria-hidden', visible ? 'false' : 'true');
            editorHelpPanel.style.display = visible ? 'flex' : 'none';
        }
        if (toggleEditorHelpButton) {
            toggleEditorHelpButton.textContent = visible ? 'Ocultar ayuda rapida' : 'Mostrar ayuda rapida';
        }
    }

    function toggleEditorHelpVisibility() {
        setEditorHelpVisibility(!editorHelpVisible);
    }

    function setFpsVisibility(visible) {
        fpsVisible = visible;
        if (uiOverlay) {
            uiOverlay.hidden = !visible;
            uiOverlay.style.display = visible ? 'flex' : 'none';
        }
        if (fpsPanel) {
            fpsPanel.hidden = !visible;
        }
        if (toggleFpsButton) {
            toggleFpsButton.textContent = visible ? 'Ocultar FPS' : 'Mostrar FPS';
        }
    }

    function toggleFpsVisibility() {
        setFpsVisibility(!fpsVisible);
    }

    function setFpsValue(value) {
        if (!fpsDisplay) return;
        fpsDisplay.textContent = `FPS: ${Math.round(value)}`;
    }

    function onExportGLTF(handler) {
        bindMenuAction(exportGltfButton, handler);
    }

    function onExportOBJ(handler) {
        bindMenuAction(exportObjButton, handler);
    }

    function onSaveProject(handler) {
        bindMenuAction(saveProjectButton, handler);
    }

    function onImportProject(handler) {
        projectImportHandler = handler;
    }

    function onImportModel(handler) {
        modelImportHandler = handler;
    }

    function onOpenUvEditor(handler) {
        bindMenuAction(openUvEditorButton, handler);
    }

    function onTextureTargetScopeChange(handler) {
        for (const input of textureScopeInputs) {
            input.addEventListener('change', () => {
                if (input.checked) handler(input.value);
            });
        }
    }

    function getTextureTargetScope() {
        const active = textureScopeInputs.find((input) => input.checked);
        return active ? active.value : 'selection';
    }

    function setTextureTargetScope(value) {
        for (const input of textureScopeInputs) {
            input.checked = input.value === value;
        }
    }

    function onGeometryChange(handler) {
        for (const input of geometryInputs) {
            input.addEventListener('change', () => {
                if (input.checked) handler(input.value);
            });
        }
    }

    if (faceNeighborDepthInput) {
        faceNeighborDepthInput.addEventListener('input', () => {
            const parsed = Number.parseInt(faceNeighborDepthInput.value, 10);
            if (!Number.isFinite(parsed) || parsed < 0) {
                faceNeighborDepthInput.value = '0';
            }
        });
    }

    if (toggleEditorHelpButton) {
        bindMenuAction(toggleEditorHelpButton, toggleEditorHelpVisibility);
    }

    if (toggleFpsButton) {
        bindMenuAction(toggleFpsButton, toggleFpsVisibility);
    }

    if (loadProjectButton) {
        bindMenuAction(loadProjectButton, openProjectImportDialog);
    }

    if (closeTextureModalButton) {
        closeTextureModalButton.addEventListener('click', () => {
            showTextureManager(false);
        });
    }

    if (textureModal) {
        textureModal.addEventListener('pointerdown', (event) => {
            if (event.target !== textureModal) return;
            showTextureManager(false);
        });
    }

    window.addEventListener('simple3d-native-menu', (event) => {
        const detail = event.detail ?? {};

        if (detail.action === 'set-geometry' && detail.value) {
            setGeometry(detail.value);
        }

        if (detail.action === 'import-obj') {
            openModelImportDialog('obj');
        }

        if (detail.action === 'import-fbx') {
            openModelImportDialog('fbx');
        }

        if (detail.action === 'load-project') {
            openProjectImportDialog();
        }

        if (detail.action === 'native-menus-ready' && hasNativeMenus) {
            closeAllMenus();
        }

        if (nativeMenuActionHandler) {
            nativeMenuActionHandler(detail);
        }
    });

    window.addEventListener('wheel', (event) => {
        if (!event.ctrlKey || event.altKey || event.metaKey) return;
        if (isTextureManagerVisible()) return;
        if (controlModeInputs.length === 0 || !controlModeChangeHandler) return;

        const step = getWheelStep(event);
        if (step === 0) return;

        event.preventDefault();
        event.stopPropagation();
        cycleControlMode(step);
    }, { passive: false, capture: true });

    setEditorHelpVisibility(editorHelpVisible);
    setFpsVisibility(fpsVisible);

    return {
        update,
        onCleanupLines,
        onMergeBlocks,
        onMergeSelectedBlocks,
        onNativeMenuAction,
        onControlModeChange,
        setControlMode,
        showTextureManager,
        isTextureManagerVisible,
        setMergeSelectedBlocksEnabled,
        setGeometry,
        setEditorHelpVisibility,
        toggleEditorHelpVisibility,
        setFpsVisibility,
        toggleFpsVisibility,
        setFpsValue,
        onSaveProject,
        onImportProject,
        openProjectImportDialog,
        onExportGLTF,
        onExportOBJ,
        onImportModel,
        onOpenUvEditor,
        onTextureTargetScopeChange,
        getTextureTargetScope,
        setTextureTargetScope,
        onGeometryChange
    };
}
