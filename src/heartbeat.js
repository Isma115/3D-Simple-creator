export function startHeartbeat() {
    setInterval(() => {
        fetch('/heartbeat').catch(() => {});
    }, 2000);

    window.addEventListener('beforeunload', () => {
        navigator.sendBeacon('/shutdown');
    });
}
