function clonePoint(point) {
    return { id: point.id, x: point.x, y: point.y };
}

function clonePoints(points) {
    return points.map(clonePoint);
}

function getBounds(points) {
    if (!points || points.length === 0) {
        return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const point of points) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: Math.max(maxX - minX, 1e-6),
        height: Math.max(maxY - minY, 1e-6)
    };
}

function createHandleDescriptors(bounds) {
    if (!bounds) return [];
    return [
        { name: 'nw', x: bounds.minX, y: bounds.maxY, cursor: 'nwse-resize' },
        { name: 'ne', x: bounds.maxX, y: bounds.maxY, cursor: 'nesw-resize' },
        { name: 'se', x: bounds.maxX, y: bounds.minY, cursor: 'nwse-resize' },
        { name: 'sw', x: bounds.minX, y: bounds.minY, cursor: 'nesw-resize' }
    ];
}

export function createUvEditor() {
    const panel = document.getElementById('uv-editor-panel');
    const canvas = document.getElementById('uv-editor-canvas');
    const resetButton = document.getElementById('uv-editor-reset-btn');
    const closeButton = document.getElementById('close-uv-editor-btn');
    const emptyMessage = document.getElementById('uv-editor-empty');

    if (!panel || !canvas) {
        return {
            show: () => {},
            hide: () => {},
            isVisible: () => false
        };
    }

    const ctx = canvas.getContext('2d');
    const HANDLE_RADIUS_PX = 8;
    const FRAME_PADDING_PX = 18;
    let session = null;
    let workingPoints = [];
    let interaction = null;

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        const width = Math.max(Math.round(rect.width || canvas.width), 1);
        const height = Math.max(Math.round(rect.height || canvas.height), 1);
        const dpr = window.devicePixelRatio || 1;

        if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { width, height };
    }

    function getViewport() {
        const { width, height } = resizeCanvas();
        const size = Math.max(Math.min(width, height) - FRAME_PADDING_PX * 2, 10);
        const offsetX = (width - size) / 2;
        const offsetY = (height - size) / 2;
        return { width, height, size, offsetX, offsetY };
    }

    function uvToCanvas(point, viewport) {
        return {
            x: viewport.offsetX + point.x * viewport.size,
            y: viewport.offsetY + (1 - point.y) * viewport.size
        };
    }

    function canvasToUv(x, y, viewport) {
        return {
            x: (x - viewport.offsetX) / viewport.size,
            y: 1 - (y - viewport.offsetY) / viewport.size
        };
    }

    function getPointerPosition(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    function drawChecker(viewport) {
        const square = viewport.size / 8;
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                ctx.fillStyle = (row + col) % 2 === 0 ? '#2a2d34' : '#1d2026';
                ctx.fillRect(
                    viewport.offsetX + col * square,
                    viewport.offsetY + row * square,
                    square,
                    square
                );
            }
        }
    }

    function drawTexture(viewport) {
        const image = session?.texture?.image;
        if (!image) return;

        try {
            ctx.drawImage(image, viewport.offsetX, viewport.offsetY, viewport.size, viewport.size);
        } catch {
            // Ignore drawing errors while the image is still decoding.
        }
    }

    function drawWireframe(viewport, pointsById) {
        if (!session?.triangles || session.triangles.length === 0) return;
        ctx.save();
        ctx.lineWidth = 1.25;
        ctx.strokeStyle = 'rgba(255, 183, 77, 0.95)';
        ctx.fillStyle = 'rgba(255, 167, 38, 0.14)';

        for (const triangle of session.triangles) {
            const a = pointsById.get(triangle[0]);
            const b = pointsById.get(triangle[1]);
            const c = pointsById.get(triangle[2]);
            if (!a || !b || !c) continue;

            const pa = uvToCanvas(a, viewport);
            const pb = uvToCanvas(b, viewport);
            const pc = uvToCanvas(c, viewport);

            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.lineTo(pc.x, pc.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }

    function drawBounds(bounds, viewport) {
        if (!bounds) return;

        const topLeft = uvToCanvas({ x: bounds.minX, y: bounds.maxY }, viewport);
        const bottomRight = uvToCanvas({ x: bounds.maxX, y: bounds.minY }, viewport);
        const width = bottomRight.x - topLeft.x;
        const height = bottomRight.y - topLeft.y;

        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(topLeft.x, topLeft.y, width, height);
        ctx.setLineDash([]);

        for (const handle of createHandleDescriptors(bounds)) {
            const point = uvToCanvas(handle, viewport);
            ctx.beginPath();
            ctx.fillStyle = '#ffb74d';
            ctx.strokeStyle = '#111111';
            ctx.lineWidth = 1.5;
            ctx.arc(point.x, point.y, HANDLE_RADIUS_PX - 1, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }

    function render() {
        const viewport = getViewport();
        ctx.clearRect(0, 0, viewport.width, viewport.height);

        drawChecker(viewport);
        drawTexture(viewport);

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(viewport.offsetX, viewport.offsetY, viewport.size, viewport.size);
        ctx.restore();

        if (!session || workingPoints.length === 0) {
            if (emptyMessage) emptyMessage.style.display = 'block';
            return;
        }

        if (emptyMessage) emptyMessage.style.display = 'none';

        const pointsById = new Map(workingPoints.map((point) => [point.id, point]));
        drawWireframe(viewport, pointsById);
        drawBounds(getBounds(workingPoints), viewport);
    }

    function findHandle(pointer, viewport) {
        const bounds = getBounds(workingPoints);
        for (const handle of createHandleDescriptors(bounds)) {
            const point = uvToCanvas(handle, viewport);
            const dx = point.x - pointer.x;
            const dy = point.y - pointer.y;
            if ((dx * dx) + (dy * dy) <= HANDLE_RADIUS_PX * HANDLE_RADIUS_PX) {
                return handle;
            }
        }
        return null;
    }

    function pointInsideBounds(pointerUv, bounds) {
        if (!bounds) return false;
        return (
            pointerUv.x >= bounds.minX &&
            pointerUv.x <= bounds.maxX &&
            pointerUv.y >= bounds.minY &&
            pointerUv.y <= bounds.maxY
        );
    }

    function updateCursor(event) {
        if (!session || workingPoints.length === 0) {
            canvas.style.cursor = 'default';
            return;
        }

        const viewport = getViewport();
        const pointer = getPointerPosition(event);
        const handle = findHandle(pointer, viewport);
        if (handle) {
            canvas.style.cursor = handle.cursor;
            return;
        }

        const pointerUv = canvasToUv(pointer.x, pointer.y, viewport);
        canvas.style.cursor = pointInsideBounds(pointerUv, getBounds(workingPoints)) ? 'move' : 'default';
    }

    function syncPoints(nextPoints) {
        workingPoints = clonePoints(nextPoints);
        render();
    }

    function beginInteraction(event) {
        if (!session || workingPoints.length === 0 || event.button !== 0) return;

        const viewport = getViewport();
        const pointer = getPointerPosition(event);
        const pointerUv = canvasToUv(pointer.x, pointer.y, viewport);
        const bounds = getBounds(workingPoints);
        const handle = findHandle(pointer, viewport);

        if (!handle && !pointInsideBounds(pointerUv, bounds)) {
            return;
        }

        const anchors = {
            nw: { x: bounds.maxX, y: bounds.minY },
            ne: { x: bounds.minX, y: bounds.minY },
            se: { x: bounds.minX, y: bounds.maxY },
            sw: { x: bounds.maxX, y: bounds.maxY }
        };

        interaction = {
            type: handle ? 'scale' : 'move',
            handle: handle?.name ?? null,
            anchor: handle ? anchors[handle.name] : null,
            startPointer: pointerUv,
            startPoints: clonePoints(workingPoints),
            startBounds: bounds
        };

        canvas.setPointerCapture(event.pointerId);
        event.preventDefault();
    }

    function updateInteraction(event) {
        if (!interaction || !session) {
            updateCursor(event);
            return;
        }

        const viewport = getViewport();
        const pointer = getPointerPosition(event);
        const pointerUv = canvasToUv(pointer.x, pointer.y, viewport);
        let nextPoints = clonePoints(interaction.startPoints);

        if (interaction.type === 'move') {
            const dx = pointerUv.x - interaction.startPointer.x;
            const dy = pointerUv.y - interaction.startPointer.y;
            nextPoints = interaction.startPoints.map((point) => ({
                id: point.id,
                x: point.x + dx,
                y: point.y + dy
            }));
        } else if (interaction.type === 'scale' && interaction.anchor) {
            const handlePoint = {
                nw: { x: interaction.startBounds.minX, y: interaction.startBounds.maxY },
                ne: { x: interaction.startBounds.maxX, y: interaction.startBounds.maxY },
                se: { x: interaction.startBounds.maxX, y: interaction.startBounds.minY },
                sw: { x: interaction.startBounds.minX, y: interaction.startBounds.minY }
            }[interaction.handle];

            const startVectorX = handlePoint.x - interaction.anchor.x;
            const startVectorY = handlePoint.y - interaction.anchor.y;
            let scaleX = startVectorX === 0 ? 1 : (pointerUv.x - interaction.anchor.x) / startVectorX;
            let scaleY = startVectorY === 0 ? 1 : (pointerUv.y - interaction.anchor.y) / startVectorY;

            if (Math.abs(scaleX) < 0.05) scaleX = 0.05 * Math.sign(scaleX || 1);
            if (Math.abs(scaleY) < 0.05) scaleY = 0.05 * Math.sign(scaleY || 1);

            nextPoints = interaction.startPoints.map((point) => ({
                id: point.id,
                x: interaction.anchor.x + (point.x - interaction.anchor.x) * scaleX,
                y: interaction.anchor.y + (point.y - interaction.anchor.y) * scaleY
            }));
        }

        session.update(nextPoints);
        syncPoints(nextPoints);
        event.preventDefault();
    }

    function endInteraction(event) {
        if (!interaction) return;
        interaction = null;
        canvas.releasePointerCapture(event.pointerId);
        updateCursor(event);
    }

    canvas.addEventListener('pointerdown', beginInteraction);
    canvas.addEventListener('pointermove', updateInteraction);
    canvas.addEventListener('pointerup', endInteraction);
    canvas.addEventListener('pointercancel', endInteraction);
    canvas.addEventListener('pointerleave', (event) => {
        if (!interaction) {
            canvas.style.cursor = 'default';
        } else {
            updateInteraction(event);
        }
    });

    if (resetButton) {
        resetButton.addEventListener('click', () => {
            if (!session) return;
            const nextData = session.reset();
            syncPoints(nextData.points);
        });
    }

    if (closeButton) {
        closeButton.addEventListener('click', () => {
            session = null;
            workingPoints = [];
            interaction = null;
            canvas.style.cursor = 'default';
            render();
        });
    }

    window.addEventListener('resize', render);
    render();

    return {
        show(nextSession) {
            session = nextSession;
            workingPoints = clonePoints(nextSession?.points ?? []);
            canvas.style.cursor = 'default';
            render();
        },
        hide() {
            session = null;
            workingPoints = [];
            interaction = null;
            canvas.style.cursor = 'default';
            render();
        },
        isVisible() {
            return panel.style.display !== 'none';
        }
    };
}
