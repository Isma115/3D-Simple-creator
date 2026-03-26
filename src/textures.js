import * as THREE from 'three';

export function createTextureManager() {
    const textureModal = document.getElementById('texture-modal');
    const uploadInput = document.getElementById('texture-upload-input');
    const uploadBtn = document.getElementById('texture-upload-btn');
    const quickUploadBtn = document.getElementById('quick-upload-texture-btn');
    const textureListEl = document.getElementById('texture-list');
    const quickTextureListEl = document.getElementById('quick-texture-list');
    const applyBtn = document.getElementById('apply-texture-btn');
    const quickApplyBtn = document.getElementById('quick-apply-texture-btn');
    const quickTextureStatus = document.getElementById('quick-texture-status');
    const quickTextureContent = document.getElementById('quick-texture-content');
    const toggleQuickTexturesBtn = document.getElementById('toggle-quick-textures-btn');

    const textures = []; // Array of { id, url, threeTexture }
    let selectedTextureId = null;
    let onApplyCallback = null;
    let onQuickApplyCallback = null;
    let onSelectionChangeCallback = null;
    let quickApplyAvailable = false;
    let quickPanelExpanded = false;
    
    const textureLoader = new THREE.TextureLoader();

    function setQuickPanelExpanded(expanded) {
        quickPanelExpanded = expanded;
        if (quickTextureContent) {
            quickTextureContent.style.display = expanded ? 'block' : 'none';
        }
        if (toggleQuickTexturesBtn) {
            toggleQuickTexturesBtn.textContent = expanded ? 'Ocultar lista' : 'Mostrar lista';
        }
    }

    function updateQuickStatus() {
        if (!quickTextureStatus) return;

        if (!quickApplyAvailable) {
            quickTextureStatus.textContent = 'Selecciona una cara para usar el acceso rapido.';
            return;
        }

        if (textures.length === 0) {
            quickTextureStatus.textContent = 'Carga una textura desde "Editar UV" y aparecera aqui.';
            return;
        }

        if (selectedTextureId === null) {
            quickTextureStatus.textContent = 'Selecciona una textura de la lista horizontal.';
            return;
        }

        quickTextureStatus.textContent = 'Pulsa "Aplicar textura" para usarla en la cara seleccionada.';
    }

    function updateApplyButtons() {
        if (applyBtn) {
            applyBtn.disabled = selectedTextureId === null;
        }
        if (quickApplyBtn) {
            quickApplyBtn.disabled = !(selectedTextureId !== null && quickApplyAvailable);
        }
        updateQuickStatus();
    }

    function createTextureItem(tex) {
        const item = document.createElement('div');
        item.className = 'texture-item' + (tex.id === selectedTextureId ? ' selected' : '');
        item.style.backgroundImage = `url(${tex.url})`;
        item.title = tex.name || 'Textura';

        item.addEventListener('click', () => {
            selectedTextureId = tex.id;
            updateApplyButtons();
            renderLists();
            if (onSelectionChangeCallback) onSelectionChangeCallback(tex.threeTexture);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'texture-delete';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeTexture(tex.id);
        });

        item.appendChild(deleteBtn);
        return item;
    }

    function renderList(container, displayModeWhenFilled, emptyDisplay = 'none') {
        if (!container) return;
        container.innerHTML = '';

        if (textures.length === 0) {
            container.style.display = emptyDisplay;
            return;
        }

        container.style.display = displayModeWhenFilled;

        textures.forEach(tex => {
            container.appendChild(createTextureItem(tex));
        });
    }

    function renderLists() {
        renderList(textureListEl, 'grid');
        renderList(quickTextureListEl, 'flex');
        updateApplyButtons();
    }

    function removeTexture(id) {
        const index = textures.findIndex(t => t.id === id);
        if (index !== -1) {
            const tex = textures[index];
            if (tex.threeTexture) {
                tex.threeTexture.dispose();
            }
            URL.revokeObjectURL(tex.url);
            textures.splice(index, 1);
            if (selectedTextureId === id) {
                selectedTextureId = null;
            }
            renderLists();
            if (onSelectionChangeCallback) {
                onSelectionChangeCallback(selectedTextureId ? textures.find(t => t.id === selectedTextureId)?.threeTexture ?? null : null);
            }
        }
    }

    function openUploadDialog() {
        if (!uploadInput) return;
        uploadInput.click();
    }

    // Bind UI Events
    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', openUploadDialog);
    }

    if (quickUploadBtn && uploadInput) {
        quickUploadBtn.addEventListener('click', openUploadDialog);
    }

    if (uploadInput) {
        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const url = URL.createObjectURL(file);
            textureLoader.load(url, (threeTexture) => {
                threeTexture.colorSpace = THREE.SRGBColorSpace;
                threeTexture.wrapS = THREE.RepeatWrapping;
                threeTexture.wrapT = THREE.RepeatWrapping;
                
                const texData = {
                    id: Date.now().toString(),
                    name: file.name,
                    url,
                    threeTexture
                };
                textures.push(texData);
                selectedTextureId = texData.id;
                renderLists();
                if (onSelectionChangeCallback) onSelectionChangeCallback(texData.threeTexture);
            });
            // Reset input so the same file could be loaded again if deleted
            uploadInput.value = '';
        });
    }
    
    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            if (selectedTextureId && onApplyCallback) {
                const tex = textures.find(t => t.id === selectedTextureId);
                if (tex) {
                    onApplyCallback(tex.threeTexture);
                }
            }
        });
    }

    if (quickApplyBtn) {
        quickApplyBtn.addEventListener('click', () => {
            if (selectedTextureId && onQuickApplyCallback) {
                const tex = textures.find((item) => item.id === selectedTextureId);
                if (tex) {
                    onQuickApplyCallback(tex.threeTexture);
                }
            }
        });
    }

    if (toggleQuickTexturesBtn) {
        toggleQuickTexturesBtn.addEventListener('click', () => {
            setQuickPanelExpanded(!quickPanelExpanded);
        });
    }

    setQuickPanelExpanded(false);
    renderLists();

    return {
        show: () => {
            if (textureModal) textureModal.style.display = 'flex';
        },
        hide: () => {
            if (textureModal) textureModal.style.display = 'none';
        },
        onApply: (cb) => {
            onApplyCallback = cb;
        },
        onQuickApply: (cb) => {
            onQuickApplyCallback = cb;
        },
        onSelectionChange: (cb) => {
            onSelectionChangeCallback = cb;
        },
        setQuickApplyAvailable: (available) => {
            quickApplyAvailable = available;
            updateApplyButtons();
        },
        getSelectedTexture: () => {
            if (!selectedTextureId) return null;
            const tex = textures.find(t => t.id === selectedTextureId);
            return tex ? tex.threeTexture : null;
        }
    };
}
