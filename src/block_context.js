import * as THREE from 'three';

export function attachBlockContextMenu({ camera, renderer, state, blockManager, undoManager, onUpdate }) {
    if (!blockManager) return { dispose: () => {} };

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let currentEntry = null;

    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.display = 'none';
    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = 'Dividir';
    menu.appendChild(action);
    document.body.appendChild(menu);

    function updateMouse(event) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }

    function pickBlockEntry() {
        const entries = blockManager.getBlockEntries().filter((entry) => entry.active);
        if (entries.length === 0) return null;
        const meshes = entries.map((entry) => entry.mesh);
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(meshes, false);
        if (hits.length === 0) return null;
        return blockManager.getBlockByMesh(hits[0].object) ?? null;
    }

    function hideMenu() {
        currentEntry = null;
        menu.style.display = 'none';
    }

    function showMenu(x, y, entry) {
        currentEntry = entry;
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = 'block';
    }

    function onContextMenu(event) {
        if (state.controlMode !== 'blocks-keyboard') {
            hideMenu();
            return;
        }
        event.preventDefault();
        updateMouse(event);
        const entry = pickBlockEntry();
        if (!entry) {
            hideMenu();
            return;
        }
        showMenu(event.clientX + 6, event.clientY + 6, entry);
    }

    function onDocumentPointerDown(event) {
        if (menu.style.display === 'none') return;
        if (menu.contains(event.target)) return;
        hideMenu();
    }

    action.addEventListener('click', () => {
        if (!currentEntry) return;
        const cursorBefore = state.currentPosition.clone();
        const result = blockManager.splitBlock(currentEntry);
        if (!result) {
            hideMenu();
            return;
        }
        undoManager.pushAction({
            kind: 'block-split',
            parentEntry: result.parent,
            childEntries: result.children,
            cursorBefore,
            cursorAfter: state.currentPosition.clone()
        });
        onUpdate();
        hideMenu();
    });

    renderer.domElement.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerdown', onDocumentPointerDown);

    return {
        dispose: () => {
            renderer.domElement.removeEventListener('contextmenu', onContextMenu);
            document.removeEventListener('pointerdown', onDocumentPointerDown);
            menu.remove();
        }
    };
}
