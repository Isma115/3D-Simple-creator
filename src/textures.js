import * as THREE from 'three';

const TEXTURE_FILE_EXTENSIONS = [
    '.png', '.apng', '.jpg', '.jpeg', '.jpe', '.jfif', '.pjpeg', '.pjp',
    '.webp', '.avif', '.gif', '.bmp', '.dib', '.svg', '.svgz', '.ico', '.cur',
    '.tif', '.tiff', '.heic', '.heif', '.qoi', '.tga', '.pnm', '.pbm', '.pgm', '.ppm', '.pam'
];
const TEXTURE_FILE_ACCEPT = `${TEXTURE_FILE_EXTENSIONS.join(',')},image/*`;
const TEXTURE_FILE_FORMATS_LABEL = 'PNG, APNG, JPG, JPEG, JPE, JFIF, PJPEG, PJP, WEBP, AVIF, GIF, BMP, DIB, SVG, SVGZ, ICO, CUR, TIF, TIFF, HEIC, HEIF, QOI, TGA, PNM, PBM, PGM, PPM y PAM.';
const NO_TEXTURE_ID = '__no-texture__';

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
    const quickTextureTransform = document.getElementById('quick-texture-transform');
    const quickTextureOffsetX = document.getElementById('quick-texture-offset-x');
    const quickTextureOffsetY = document.getElementById('quick-texture-offset-y');
    const quickTextureOffsetXValue = document.getElementById('quick-texture-offset-x-value');
    const quickTextureOffsetYValue = document.getElementById('quick-texture-offset-y-value');

    const textures = []; // Array of { id, name, dataUrl, threeTexture }
    let selectedTextureId = null;
    let onApplyCallback = null;
    let onQuickApplyCallback = null;
    let onSelectionChangeCallback = null;
    let onTransformChangeCallback = null;
    let quickApplyAvailable = false;
    
    const textureLoader = new THREE.TextureLoader();

    function updateQuickStatus() {
        if (!quickTextureStatus) return;

        if (!quickApplyAvailable) {
            quickTextureStatus.textContent = 'Selecciona una cara para activar este panel.';
            return;
        }

        if (textures.length === 0) {
            quickTextureStatus.textContent = 'Carga una textura o usa Sin textura.';
            return;
        }

        if (selectedTextureId === null) {
            quickTextureStatus.textContent = 'Elige una textura o Sin textura.';
            return;
        }

        if (selectedTextureId === NO_TEXTURE_ID) {
            quickTextureStatus.textContent = 'Pulsa "Aplicar" para quitar la textura.';
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

    function getSelectedTextureEntry() {
        if (!selectedTextureId || selectedTextureId === NO_TEXTURE_ID) return null;
        return textures.find((item) => item.id === selectedTextureId) ?? null;
    }

    function updateTransformControls() {
        const selectedTexture = getSelectedTextureEntry()?.threeTexture ?? null;
        const visible = Boolean(selectedTexture);

        if (quickTextureTransform) {
            quickTextureTransform.hidden = !visible;
        }

        if (!selectedTexture) {
            if (quickTextureOffsetX) quickTextureOffsetX.value = '0';
            if (quickTextureOffsetY) quickTextureOffsetY.value = '0';
            if (quickTextureOffsetXValue) quickTextureOffsetXValue.textContent = '0.00';
            if (quickTextureOffsetYValue) quickTextureOffsetYValue.textContent = '0.00';
            return;
        }

        const offsetX = selectedTexture.offset?.x ?? 0;
        const offsetY = selectedTexture.offset?.y ?? 0;
        if (quickTextureOffsetX) quickTextureOffsetX.value = offsetX.toFixed(2);
        if (quickTextureOffsetY) quickTextureOffsetY.value = offsetY.toFixed(2);
        if (quickTextureOffsetXValue) quickTextureOffsetXValue.textContent = offsetX.toFixed(2);
        if (quickTextureOffsetYValue) quickTextureOffsetYValue.textContent = offsetY.toFixed(2);
    }

    function notifySelectionChange(texture = null) {
        if (onSelectionChangeCallback) {
            onSelectionChangeCallback(texture);
        }
    }

    function notifyTransformChange(texture = null) {
        if (onTransformChangeCallback) {
            onTransformChangeCallback(texture);
        }
    }

    function updateSelectedTextureOffset(axis, rawValue) {
        const selectedTexture = getSelectedTextureEntry()?.threeTexture ?? null;
        if (!selectedTexture || !selectedTexture.offset) return;
        const parsed = Number.parseFloat(rawValue);
        const value = Number.isFinite(parsed) ? parsed : 0;
        selectedTexture.offset[axis] = value;
        selectedTexture.needsUpdate = true;
        updateTransformControls();
        notifyTransformChange(selectedTexture);
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
        notifySelectionChange(select ? texData.threeTexture : getSelectedTextureEntry()?.threeTexture ?? null);
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
            notifySelectionChange(tex.threeTexture);
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

    function createNoTextureItem() {
        const item = document.createElement('div');
        item.className = 'texture-item texture-item-reset' + (selectedTextureId === NO_TEXTURE_ID ? ' selected' : '');
        item.title = 'Quitar textura';
        item.textContent = 'Sin textura';
        item.addEventListener('click', () => {
            selectedTextureId = NO_TEXTURE_ID;
            updateApplyButtons();
            renderLists();
            notifySelectionChange(null);
        });
        return item;
    }

    function renderList(container, displayModeWhenFilled, emptyDisplay = 'none') {
        if (!container) return;
        container.innerHTML = '';
        container.appendChild(createNoTextureItem());

        if (textures.length === 0) {
            container.style.display = displayModeWhenFilled || emptyDisplay;
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
        updateTransformControls();
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
            notifySelectionChange(getSelectedTextureEntry()?.threeTexture ?? null);
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
    
    if (quickTextureContent) {
        quickTextureContent.style.display = 'flex';
    }

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            if (selectedTextureId === null || !onApplyCallback) return;
            if (selectedTextureId === NO_TEXTURE_ID) {
                onApplyCallback(null);
                return;
            }
            const tex = textures.find(t => t.id === selectedTextureId);
            if (tex) {
                onApplyCallback(tex.threeTexture);
            }
        });
    }

    if (quickApplyBtn) {
        quickApplyBtn.addEventListener('click', () => {
            if (selectedTextureId === null || !onQuickApplyCallback) return;
            if (selectedTextureId === NO_TEXTURE_ID) {
                onQuickApplyCallback(null);
                return;
            }
            const tex = textures.find((item) => item.id === selectedTextureId);
            if (tex) {
                onQuickApplyCallback(tex.threeTexture);
            }
        });
    }

    if (quickTextureOffsetX) {
        quickTextureOffsetX.addEventListener('input', (event) => {
            updateSelectedTextureOffset('x', event.target.value);
        });
    }

    if (quickTextureOffsetY) {
        quickTextureOffsetY.addEventListener('input', (event) => {
            updateSelectedTextureOffset('y', event.target.value);
        });
    }

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
        onTransformChange: (cb) => {
            onTransformChangeCallback = cb;
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
