import * as THREE from 'three';

export function createTextureManager() {
    const texturePanel = document.getElementById('texture-manager');
    const uploadInput = document.getElementById('texture-upload-input');
    const uploadBtn = document.getElementById('texture-upload-btn');
    const textureListEl = document.getElementById('texture-list');
    const applyBtn = document.getElementById('apply-texture-btn');

    const textures = []; // Array of { id, url, threeTexture }
    let selectedTextureId = null;
    let onApplyCallback = null;
    
    const textureLoader = new THREE.TextureLoader();

    function renderList() {
        textureListEl.innerHTML = '';
        if (textures.length === 0) {
            textureListEl.style.display = 'none';
        } else {
            textureListEl.style.display = 'flex';
        }

        textures.forEach(tex => {
            const item = document.createElement('div');
            item.className = 'texture-item' + (tex.id === selectedTextureId ? ' selected' : '');
            item.style.backgroundImage = `url(${tex.url})`;
            item.title = tex.name || 'Textura';
            
            item.addEventListener('click', () => {
                selectedTextureId = tex.id;
                updateApplyButton();
                renderList();
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'texture-delete';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevents selection
                removeTexture(tex.id);
            });

            item.appendChild(deleteBtn);
            textureListEl.appendChild(item);
        });
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
                updateApplyButton();
            }
            renderList();
        }
    }

    function updateApplyButton() {
        if (selectedTextureId !== null) {
            applyBtn.disabled = false;
        } else {
            applyBtn.disabled = true;
        }
    }

    // Bind UI Events
    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', () => {
            uploadInput.click();
        });

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
                updateApplyButton();
                renderList();
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

    return {
        show: () => {
            if (texturePanel) texturePanel.style.display = 'flex';
        },
        hide: () => {
            if (texturePanel) texturePanel.style.display = 'none';
        },
        onApply: (cb) => {
            onApplyCallback = cb;
        },
        getSelectedTexture: () => {
            if (!selectedTextureId) return null;
            const tex = textures.find(t => t.id === selectedTextureId);
            return tex ? tex.threeTexture : null;
        }
    };
}
