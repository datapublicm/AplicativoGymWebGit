const VIEW_YAW = {
    front: 0,
    front_3q: 0.55,
    side_left: -Math.PI / 2,
    side_right: Math.PI / 2,
    back_3q: Math.PI - 0.55,
    back: Math.PI,
};
function wrap(angle) {
    let value = angle % (Math.PI * 2);
    if (value > Math.PI)
        value -= Math.PI * 2;
    if (value < -Math.PI)
        value += Math.PI * 2;
    return value;
}
export function rotateToPreferredView(current, target, options) {
    const canonical = VIEW_YAW[target];
    const yaw = current.yaw + wrap(canonical - current.yaw);
    return {
        from: { ...current },
        to: { yaw, pitch: 0, distance: current.distance },
        durationMs: Math.max(0, options.durationMs),
    };
}
function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
function nextFrame(callback) {
    if (typeof requestAnimationFrame === 'function')
        return requestAnimationFrame(() => callback(performance.now()));
    return setTimeout(() => callback(performance.now()), 8);
}
export function animateRotation(plan, apply, signal) {
    if (signal?.aborted)
        return Promise.resolve('cancelled');
    if (plan.durationMs === 0) {
        apply({ ...plan.to });
        return Promise.resolve('completed');
    }
    return new Promise(resolve => {
        const start = performance.now();
        let settled = false;
        const finish = (value) => {
            if (settled)
                return;
            settled = true;
            signal?.removeEventListener('abort', onAbort);
            resolve(value);
        };
        const onAbort = () => finish('cancelled');
        signal?.addEventListener('abort', onAbort, { once: true });
        const tick = (now) => {
            if (settled || signal?.aborted)
                return finish('cancelled');
            const raw = Math.min(1, Math.max(0, (now - start) / plan.durationMs));
            const t = easeInOut(raw);
            apply({
                yaw: plan.from.yaw + (plan.to.yaw - plan.from.yaw) * t,
                pitch: plan.from.pitch + (plan.to.pitch - plan.from.pitch) * t,
                distance: plan.from.distance + (plan.to.distance - plan.from.distance) * t,
            });
            if (raw >= 1) {
                apply({ ...plan.to });
                finish('completed');
            }
            else {
                nextFrame(tick);
            }
        };
        nextFrame(tick);
    });
}
