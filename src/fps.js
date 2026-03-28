export function createFpsTracker(sampleSize = 24) {
    const samples = [];
    let lastTimestamp = 0;

    function tick(timestamp) {
        if (lastTimestamp === 0) {
            lastTimestamp = timestamp;
            return 0;
        }

        const delta = timestamp - lastTimestamp;
        lastTimestamp = timestamp;
        if (delta <= 0) {
            return samples.length > 0 ? samples[samples.length - 1] : 0;
        }

        const fps = 1000 / delta;
        samples.push(fps);
        if (samples.length > sampleSize) {
            samples.shift();
        }

        const total = samples.reduce((sum, value) => sum + value, 0);
        return total / samples.length;
    }

    return { tick };
}
