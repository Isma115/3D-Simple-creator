export function createUI() {
    const coordsDisplay = document.getElementById('coordinates-display');
    const facesValue = document.getElementById('stat-faces');
    const verticesValue = document.getElementById('stat-vertices');
    const pointsValue = document.getElementById('stat-points');
    const linesValue = document.getElementById('stat-lines');
    const cleanupButton = document.getElementById('cleanup-lines-button');
    const controlModeInputs = Array.from(document.querySelectorAll('input[name="control-mode"]'));

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

    function onControlModeChange(handler) {
        if (controlModeInputs.length === 0) return;
        for (const input of controlModeInputs) {
            input.addEventListener('change', () => {
                if (input.checked) handler(input.value);
            });
        }
    }

    function setControlMode(value) {
        if (controlModeInputs.length === 0) return;
        for (const input of controlModeInputs) {
            input.checked = input.value === value;
        }
    }

    return { update, onCleanupLines, onControlModeChange, setControlMode };
}
