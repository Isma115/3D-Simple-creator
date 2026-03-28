export function createUI() {
    const urlParams = new URLSearchParams(window.location.search);
    const hasNativeMenus = urlParams.get('nativeMenus') === '1';
    const coordsDisplay = document.getElementById('coordinates-display');
    const geometryDisplay = document.getElementById('active-geometry-display');
    const fpsPanel = document.getElementById('fps-panel');
    const fpsDisplay = document.getElementById('fps-display');
    const cleanupButton = document.getElementById('cleanup-lines-button');
    const mergeBlocksButton = document.getElementById('merge-blocks-button');
    const mergeSelectedBlocksButton = document.getElementById('merge-selected-blocks-button');
    const clearPointSelectionButton = document.getElementById('clear-point-selection-button');
    const toggleWorkModeButton = document.getElementById('toggle-work-mode-btn');
    const controlModeInputs = Array.from(document.querySelectorAll('input[name="control-mode"]'));
    const controlModeToast = document.getElementById('control-mode-toast');
    const controlModeToastValue = document.getElementById('control-mode-toast-value');
    const geometryInputs = Array.from(document.querySelectorAll('input[name="geometry-type"]'));
    const geometryInventory = document.getElementById('geometry-inventory');
    const inventoryMenuButton = document.getElementById('inventory-menu-btn');
    const inventoryMenu = document.getElementById('inventory-menu');
    const editMenuButton = document.getElementById('edit-menu-btn');
    const editMenu = document.getElementById('edit-menu');
    const exportGltfButton = document.getElementById('export-gltf-btn');
    const exportObjButton = document.getElementById('export-obj-btn');
    const openUvEditorButton = document.getElementById('open-uv-editor-btn');
    const textureScopeInputs = Array.from(document.querySelectorAll('input[name="texture-target-scope"]'));
    const textureModal = document.getElementById('texture-modal');
    const closeTextureModalButton = document.getElementById('close-texture-modal-btn');
    let controlModeChangeHandler = null;
    let controlModeToastHideTimer = null;
    let nativeMenuActionHandler = null;
    let fpsVisible = false;
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

    if (hasNativeMenus) {
        document.body.dataset.nativeMenus = 'true';
    }

    const menus = [
        { button: inventoryMenuButton, panel: inventoryMenu },
        { button: editMenuButton, panel: editMenu }
    ].filter(({ button, panel }) => button && panel);

    function setMenuOpen(button, panel, open) {
        panel.hidden = !open;
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
        const group = button.closest('.menu-group');
        if (group) {
            group.dataset.open = open ? 'true' : 'false';
        }
    }

    function closeAllMenus(exceptPanel = null) {
        for (const menu of menus) {
            const shouldRemainOpen = menu.panel === exceptPanel && !menu.panel.hidden;
            setMenuOpen(menu.button, menu.panel, shouldRemainOpen);
        }
    }

    function toggleMenu(button, panel) {
        const willOpen = panel.hidden;
        closeAllMenus();
        setMenuOpen(button, panel, willOpen);
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

    function update({ position }) {
        coordsDisplay.textContent = `X: ${position.x.toFixed(1)}, Y: ${position.y.toFixed(1)}, Z: ${position.z.toFixed(1)}`;
    }

    function onCleanupLines(handler) {
        if (!cleanupButton) return;
        cleanupButton.addEventListener('click', () => {
            closeAllMenus();
            handler();
        });
    }

    function onClearPointSelection(handler) {
        if (!clearPointSelectionButton) return;
        clearPointSelectionButton.addEventListener('click', handler);
    }

    function onNativeMenuAction(handler) {
        nativeMenuActionHandler = handler;
    }

    function onMergeBlocks(handler) {
        if (!mergeBlocksButton) return;
        mergeBlocksButton.addEventListener('click', () => {
            closeAllMenus();
            handler();
        });
    }

    function onMergeSelectedBlocks(handler) {
        if (!mergeSelectedBlocksButton) return;
        mergeSelectedBlocksButton.addEventListener('click', () => {
            closeAllMenus();
            handler();
        });
    }

    function onControlModeChange(handler) {
        controlModeChangeHandler = handler;
        if (controlModeInputs.length === 0) return;
        for (const input of controlModeInputs) {
            input.addEventListener('change', () => {
                if (input.checked) handler(input.value);
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

    function onWorkModeToggle(handler) {
        if (!toggleWorkModeButton) return;
        toggleWorkModeButton.addEventListener('click', () => {
            const nextMode = toggleWorkModeButton.dataset.mode === 'blueprint' ? 'classic' : 'blueprint';
            handler(nextMode);
        });
    }

    function setWorkMode(mode) {
        if (!toggleWorkModeButton) return;
        const isBlueprint = mode === 'blueprint';
        toggleWorkModeButton.dataset.mode = mode;
        toggleWorkModeButton.dataset.active = isBlueprint ? 'true' : 'false';
        toggleWorkModeButton.textContent = isBlueprint
            ? 'Volver al modo clasico'
            : 'Activar modo 4 vistas';
    }

    function setControlMode(value) {
        if (controlModeInputs.length === 0) return;
        for (const input of controlModeInputs) {
            input.checked = input.value === value;
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

    function setClearPointSelectionEnabled(enabled) {
        if (!clearPointSelectionButton) return;
        clearPointSelectionButton.disabled = !enabled;
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

    function setFpsVisibility(visible) {
        fpsVisible = visible;
        if (fpsPanel) {
            fpsPanel.hidden = !visible;
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
        if (!exportGltfButton) return;
        exportGltfButton.addEventListener('click', handler);
    }

    function onExportOBJ(handler) {
        if (!exportObjButton) return;
        exportObjButton.addEventListener('click', handler);
    }

    function onOpenUvEditor(handler) {
        if (!openUvEditorButton) return;
        openUvEditorButton.addEventListener('click', handler);
    }

    function onTextureTargetScopeChange(handler) {
        if (textureScopeInputs.length === 0) return;
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
        if (geometryInputs.length === 0) return;
        for (const input of geometryInputs) {
            input.addEventListener('change', () => {
                if (input.checked) handler(input.value);
            });
        }
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
        if (detail.action === 'native-menus-ready' && hasNativeMenus) {
            closeAllMenus();
        }
        if (nativeMenuActionHandler) {
            nativeMenuActionHandler(detail);
        }
    });

    window.addEventListener('wheel', (event) => {
        if (!event.metaKey) return;
        if (isTextureManagerVisible()) return;
        if (controlModeInputs.length === 0 || !controlModeChangeHandler) return;

        const step = getWheelStep(event);
        if (step === 0) return;

        event.preventDefault();
        event.stopPropagation();
        cycleControlMode(step);
    }, { passive: false, capture: true });

    return {
        update,
        onCleanupLines,
        onMergeBlocks,
        onMergeSelectedBlocks,
        onClearPointSelection,
        onNativeMenuAction,
        onWorkModeToggle,
        onControlModeChange,
        setWorkMode,
        setControlMode,
        showTextureManager,
        isTextureManagerVisible,
        setClearPointSelectionEnabled,
        setMergeSelectedBlocksEnabled,
        setGeometry,
        setFpsVisibility,
        toggleFpsVisibility,
        setFpsValue,
        onExportGLTF,
        onExportOBJ,
        onOpenUvEditor,
        onTextureTargetScopeChange,
        getTextureTargetScope,
        setTextureTargetScope,
        onGeometryChange
    };
}
