import * as THREE from 'three';

const TEXTURE_FILE_EXTENSIONS = [
    '.png', '.apng', '.jpg', '.jpeg', '.jpe', '.jfif', '.pjpeg', '.pjp',
    '.webp', '.avif', '.gif', '.bmp', '.dib', '.svg', '.svgz', '.ico', '.cur',
    '.tif', '.tiff', '.heic', '.heif', '.qoi', '.tga', '.pnm', '.pbm', '.pgm', '.ppm', '.pam'
];
const TEXTURE_FILE_ACCEPT = `${TEXTURE_FILE_EXTENSIONS.join(',')},image/*`;
const TEXTURE_FILE_FORMATS_LABEL = 'PNG, APNG, JPG, JPEG, JPE, JFIF, PJPEG, PJP, WEBP, AVIF, GIF, BMP, DIB, SVG, SVGZ, ICO, CUR, TIF, TIFF, HEIC, HEIF, QOI, TGA, PNM, PBM, PGM, PPM y PAM.';

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

    const textures = []; // Array of { id, name, dataUrl, threeTexture }
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
            toggleQuickTexturesBtn.textContent = expanded ? 'Ocultar' : 'Lista';
        }
    }

    function updateQuickStatus() {
        if (!quickTextureStatus) return;

        if (!quickApplyAvailable) {
            quickTextureStatus.textContent = 'Selecciona una cara para activar este panel.';
            return;
        }

        if (textures.length === 0) {
            quickTextureStatus.textContent = 'Carga una textura y aparecera aqui.';
            return;
        }

        if (selectedTextureId === null) {
            quickTextureStatus.textContent = 'Elige una textura de la lista.';
            return;
        }

        quickTextureStatus.textContent = 'Pulsa "Aplicar" para usarla en la cara seleccionada.';
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

    function loadTexture(dataUrl) {
        return new Promise((resolve, reject) => {
            textureLoader.load(
                dataUrl,
                (threeTexture) => {
                    threeTexture.colorSpace = THREE.SRGBColorSpace;
                    threeTexture.wrapS = THREE.RepeatWrapping;
                    threeTexture.wrapT = THREE.RepeatWrapping;
                    resolve(threeTexture);
                },
                undefined,
                reject
            );
        });
    }

    async function addTextureFromData({ id = Date.now().toString(), name = 'Textura', dataUrl, select = true } = {}) {
        if (!dataUrl) return null;
        const threeTexture = await loadTexture(dataUrl);
        const texData = {
            id,
            name,
            dataUrl,
            threeTexture
        };
        textures.push(texData);
        if (select) {
            selectedTextureId = texData.id;
        }
        renderLists();
        if (onSelectionChangeCallback) {
            onSelectionChangeCallback(select ? texData.threeTexture : textures.find((item) => item.id === selectedTextureId)?.threeTexture ?? null);
        }
        return texData;
    }

    async function readFileAsDataUrl(file) {
        return await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la textura.'));
            reader.readAsDataURL(file);
        });
    }

    function createTextureItem(tex) {
        const item = document.createElement('div');
        item.className = 'texture-item' + (tex.id === selectedTextureId ? ' selected' : '');
        item.style.backgroundImage = `url(${tex.dataUrl})`;
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
        uploadInput.accept = TEXTURE_FILE_ACCEPT;
        uploadInput.click();
    }

    // Bind UI Events
    if (uploadBtn && uploadInput) {
        uploadBtn.title = `Formatos permitidos: ${TEXTURE_FILE_FORMATS_LABEL}`;
        uploadBtn.addEventListener('click', openUploadDialog);
    }

    if (quickUploadBtn && uploadInput) {
        quickUploadBtn.title = `Formatos permitidos: ${TEXTURE_FILE_FORMATS_LABEL}`;
        quickUploadBtn.addEventListener('click', openUploadDialog);
    }

    if (uploadInput) {
        uploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const dataUrl = await readFileAsDataUrl(file);
                await addTextureFromData({
                    name: file.name,
                    dataUrl,
                    select: true
                });
            } catch (error) {
                console.error('Error al cargar la textura:', error);
                alert(`No se pudo cargar la textura seleccionada.\n\nPrueba con alguno de estos formatos: ${TEXTURE_FILE_FORMATS_LABEL}`);
            }
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
        },
        getProjectTextures: () => {
            return textures.map((texture) => ({
                id: texture.id,
                name: texture.name,
                dataUrl: texture.dataUrl,
                selected: texture.id === selectedTextureId
            }));
        },
        importProjectTextures: async (projectTextures = []) => {
            while (textures.length > 0) {
                removeTexture(textures[0].id);
            }

            for (const texture of projectTextures) {
                await addTextureFromData({
                    id: texture.id,
                    name: texture.name,
                    dataUrl: texture.dataUrl,
                    select: Boolean(texture.selected)
                });
            }

            if (!projectTextures.some((texture) => texture.selected)) {
                selectedTextureId = null;
                renderLists();
            }
        }
    };
}
