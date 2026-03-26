export function createUI() {
    const coordsDisplay = document.getElementById('coordinates-display');
    const facesValue = document.getElementById('stat-faces');
    const verticesValue = document.getElementById('stat-vertices');
    const pointsValue = document.getElementById('stat-points');
    const linesValue = document.getElementById('stat-lines');
    const cleanupButton = document.getElementById('cleanup-lines-button');
    const clearPointSelectionButton = document.getElementById('clear-point-selection-button');
    const toggleWorkModeButton = document.getElementById('toggle-work-mode-btn');
    const controlModeInputs = Array.from(document.querySelectorAll('input[name="control-mode"]'));
    const geometryInputs = Array.from(document.querySelectorAll('input[name="geometry-type"]'));
    const toggleInventoryBtn = document.getElementById('toggle-inventory-btn');
    const geometryInventory = document.getElementById('geometry-inventory');
    const exportGltfButton = document.getElementById('export-gltf-btn');
    const exportObjButton = document.getElementById('export-obj-btn');
    const sculptPanel = document.getElementById('sculpt-panel');
    const sculptModeInputs = Array.from(document.querySelectorAll('input[name="sculpt-mode"]'));
    const sculptRadiusInput = document.getElementById('sculpt-radius-input');
    const sculptRadiusValue = document.getElementById('sculpt-radius-value');
    const openUvEditorButton = document.getElementById('open-uv-editor-btn');
    const textureScopeInputs = Array.from(document.querySelectorAll('input[name="texture-target-scope"]'));
    const textureModal = document.getElementById('texture-modal');
    const closeTextureModalButton = document.getElementById('close-texture-modal-btn');
    let controlModeChangeHandler = null;

    if (toggleInventoryBtn && geometryInventory) {
        toggleInventoryBtn.addEventListener('click', () => {
            const isHidden = geometryInventory.style.display === 'none';
            geometryInventory.style.display = isHidden ? 'grid' : 'none';
            toggleInventoryBtn.innerHTML = `Inventario de Figuras ${isHidden ? '▲' : '▼'}`;
        });
    }

    function update({ position, stats }) {
        coordsDisplay.textContent = `X: ${position.x.toFixed(1)}, Y: ${position.y.toFixed(1)}, Z: ${position.z.toFixed(1)}`;
        if (stats) {
            facesValue.textContent = stats.faces.toString();
            verticesValue.textContent = stats.vertices.toString();
            pointsValue.textContent = stats.points.toString();
            linesValue.textContent = stats.lines.toString();
        }
    }

    function onCleanupLines(handler) {
        if (!cleanupButton) return;
        cleanupButton.addEventListener('click', handler);
    }

    function onClearPointSelection(handler) {
        if (!clearPointSelectionButton) return;
        clearPointSelectionButton.addEventListener('click', handler);
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

    function onSculptModeChange(handler) {
        if (sculptModeInputs.length === 0) return;
        for (const input of sculptModeInputs) {
            input.addEventListener('change', () => {
                if (input.checked) handler(input.value);
            });
        }
    }

    function setSculptMode(value) {
        if (sculptModeInputs.length === 0) return;
        for (const input of sculptModeInputs) {
            input.checked = input.value === value;
        }
    }

    function updateSculptRadiusLabel(value) {
        if (!sculptRadiusValue) return;
        sculptRadiusValue.textContent = Number(value).toFixed(1);
    }

    function onSculptRadiusChange(handler) {
        if (!sculptRadiusInput) return;
        sculptRadiusInput.addEventListener('input', () => {
            const value = Number(sculptRadiusInput.value);
            updateSculptRadiusLabel(value);
            handler(value);
        });
    }

    function setSculptRadius(value) {
        if (!sculptRadiusInput) return;
        sculptRadiusInput.value = String(value);
        updateSculptRadiusLabel(value);
    }

    function showSculptControls(show) {
        if (!sculptPanel) return;
        sculptPanel.style.display = show ? 'flex' : 'none';
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

    window.addEventListener('wheel', (event) => {
        if (!event.ctrlKey) return;
        if (isTextureManagerVisible()) return;
        if (controlModeInputs.length === 0 || !controlModeChangeHandler) return;

        const step = getWheelStep(event);
        if (step === 0) return;

        event.preventDefault();
        cycleControlMode(step);
    }, { passive: false });

    return {
        update,
        onCleanupLines,
        onClearPointSelection,
        onWorkModeToggle,
        onControlModeChange,
        setWorkMode,
        setControlMode,
        showTextureManager,
        isTextureManagerVisible,
        setClearPointSelectionEnabled,
        onExportGLTF,
        onExportOBJ,
        onOpenUvEditor,
        onTextureTargetScopeChange,
        getTextureTargetScope,
        setTextureTargetScope,
        onGeometryChange,
        onSculptModeChange,
        setSculptMode,
        onSculptRadiusChange,
        setSculptRadius,
        showSculptControls
    };
}
