import { multiply, perspective, rotationX, rotationY, translation } from './math.js';
import { buildMuscleRegistry } from './muscleRegistry.js';
import { applyMuscleHighlight } from './highlightMuscles.js?v=0.5.2';
import { getTargetVisibility, shouldAutoRotate } from './visibility.js';
import { animateRotation, rotateToPreferredView } from './autoRotate.js';
import { VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE } from './shaders.js?v=0.5.2';
import { cameraDistanceForAspect } from './visualStyle.js?v=0.5.2';
import { resolveExerciseMuscleTargets } from './exerciseMuscles.js';
function compile(gl, type, source) {
    const shader = gl.createShader(type);
    if (!shader)
        throw new Error('Shader allocation failed');
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader) ?? 'Shader compile failed');
    return shader;
}
export class ViewerController {
    canvas;
    gl;
    model;
    state = { yaw: 0, pitch: 0, distance: 10 };
    frame = 0;
    disposed = false;
    program;
    aPosition;
    aNormal;
    uMvp;
    uModel;
    uColor;
    uLightDirection;
    cleanup = [];
    registry;
    rotationAbort;
    currentExercise;
    constructor(canvas, gl, model) {
        this.canvas = canvas;
        this.gl = gl;
        this.model = model;
        const vs = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
        const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
        const program = gl.createProgram();
        if (!program)
            throw new Error('Program allocation failed');
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
            throw new Error(gl.getProgramInfoLog(program) ?? 'Program link failed');
        gl.deleteShader(vs);
        gl.deleteShader(fs);
        this.program = program;
        this.registry = buildMuscleRegistry(model.meshes);
        this.aPosition = gl.getAttribLocation(program, 'aPosition');
        this.aNormal = gl.getAttribLocation(program, 'aNormal');
        const uMvp = gl.getUniformLocation(program, 'uMvp');
        const uModel = gl.getUniformLocation(program, 'uModel');
        const uColor = gl.getUniformLocation(program, 'uColor');
        const uLightDirection = gl.getUniformLocation(program, 'uLightDirection');
        if (!uMvp || !uModel || !uColor || !uLightDirection)
            throw new Error('Shader uniform missing');
        this.uMvp = uMvp;
        this.uModel = uModel;
        this.uColor = uColor;
        this.uLightDirection = uLightDirection;
        const aspect = Math.max(0.01, canvas.clientWidth / Math.max(1, canvas.clientHeight));
        this.state.distance = cameraDistanceForAspect(aspect);
        this.installControls();
        this.renderLoop();
    }
    installControls() {
        const pointers = new Map();
        let dragging = false, lastX = 0, lastY = 0, pinchDistance = 0;
        const clampDistance = (value) => Math.max(6.5, Math.min(15, value));
        const currentPinchDistance = () => {
            const [a, b] = [...pointers.values()];
            return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
        };
        const down = (e) => {
            this.cancelAutoRotation();
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size === 1) {
                dragging = true;
                lastX = e.clientX;
                lastY = e.clientY;
            }
            else {
                dragging = false;
                pinchDistance = currentPinchDistance();
            }
            try {
                this.canvas.setPointerCapture?.(e.pointerId);
            }
            catch { }
        };
        const move = (e) => {
            if (!pointers.has(e.pointerId))
                return;
            pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.size >= 2) {
                const next = currentPinchDistance();
                if (pinchDistance > 0 && next > 0)
                    this.state.distance = clampDistance(this.state.distance - (next - pinchDistance) * 0.02);
                pinchDistance = next;
                return;
            }
            if (!dragging)
                return;
            this.state.yaw += (e.clientX - lastX) * 0.008;
            this.state.pitch = Math.max(-1.1, Math.min(1.1, this.state.pitch + (e.clientY - lastY) * 0.006));
            lastX = e.clientX;
            lastY = e.clientY;
        };
        const up = (e) => {
            pointers.delete(e.pointerId);
            pinchDistance = pointers.size >= 2 ? currentPinchDistance() : 0;
            const remaining = pointers.values().next().value;
            dragging = pointers.size === 1;
            if (remaining) {
                lastX = remaining.x;
                lastY = remaining.y;
            }
        };
        const wheel = (e) => {
            e.preventDefault();
            this.cancelAutoRotation();
            this.state.distance = clampDistance(this.state.distance + e.deltaY * 0.008);
        };
        this.canvas.addEventListener('pointerdown', down);
        this.canvas.addEventListener('pointermove', move);
        this.canvas.addEventListener('pointerup', up);
        this.canvas.addEventListener('pointercancel', up);
        this.canvas.addEventListener('wheel', wheel, { passive: false });
        this.cleanup.push(() => this.canvas.removeEventListener('pointerdown', down), () => this.canvas.removeEventListener('pointermove', move), () => this.canvas.removeEventListener('pointerup', up), () => this.canvas.removeEventListener('pointercancel', up), () => this.canvas.removeEventListener('wheel', wheel));
    }
    getViewState() { return { ...this.state }; }
    setViewState(next) { this.state = { ...next }; }
    getMeshes() { return this.model.meshes; }
    cancelAutoRotation() { this.rotationAbort?.abort(); this.rotationAbort = undefined; }
    replaceModel(model) {
        this.cancelAutoRotation();
        const registry = buildMuscleRegistry(model.meshes);
        if (this.currentExercise) {
            const targets = resolveExerciseMuscleTargets(this.currentExercise);
            applyMuscleHighlight(registry, targets.primary, targets.secondary);
        }
        const previous = this.model;
        this.model = model;
        this.registry = registry;
        previous?.dispose();
    }
    async selectExercise(exercise) {
        this.cancelAutoRotation();
        this.currentExercise = exercise;
        const targets = resolveExerciseMuscleTargets(exercise);
        const highlight = applyMuscleHighlight(this.registry, targets.primary, targets.secondary);
        const missing = [...new Set([...targets.unresolved, ...highlight.missing])];
        const primaryMeshes = targets.primary.flatMap(id => this.registry.get(id) ?? []);
        if (!primaryMeshes.length)
            return { rotated: false, missing };
        const visibility = getTargetVisibility(primaryMeshes, this.state);
        if (!shouldAutoRotate(visibility))
            return { rotated: false, missing };
        const abort = new AbortController();
        this.rotationAbort = abort;
        const plan = rotateToPreferredView(this.state, exercise.preferredView, { durationMs: 550, signal: abort.signal });
        const result = await animateRotation(plan, state => { this.state = state; }, abort.signal);
        if (this.rotationAbort === abort)
            this.rotationAbort = undefined;
        return { rotated: result === 'completed', missing };
    }
    getModel() {
        const rx = rotationX(this.state.pitch);
        const ry = rotationY(this.state.yaw);
        const center = translation(0, -1.35, 0);
        return multiply(rx, multiply(ry, center));
    }
    getMvp(model) {
        const aspect = Math.max(0.01, this.canvas.width / Math.max(1, this.canvas.height));
        const p = perspective(36 * Math.PI / 180, aspect, 0.1, 100);
        const tCamera = translation(0, 0, -this.state.distance);
        return multiply(p, multiply(tCamera, model));
    }
    render = () => {
        if (this.disposed)
            return;
        const gl = this.gl;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
        const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.clearColor(0.055, 0.065, 0.08, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(this.program);
        const model = this.getModel();
        gl.uniformMatrix4fv(this.uMvp, false, this.getMvp(model));
        gl.uniformMatrix4fv(this.uModel, false, model);
        gl.uniform3fv(this.uLightDirection, new Float32Array([0.45, 0.75, 0.65]));
        gl.enableVertexAttribArray(this.aPosition);
        gl.enableVertexAttribArray(this.aNormal);
        for (const mesh of this.model.meshes) {
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionBuffer);
            gl.vertexAttribPointer(this.aPosition, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, mesh.normalBuffer);
            gl.vertexAttribPointer(this.aNormal, 3, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
            gl.uniform4fv(this.uColor, mesh.color);
            gl.drawElements(gl.TRIANGLES, mesh.indexCount, gl.UNSIGNED_SHORT, 0);
        }
        this.frame = requestAnimationFrame(this.render);
    };
    renderLoop() { this.frame = requestAnimationFrame(this.render); }
    dispose() {
        this.cancelAutoRotation();
        this.disposed = true;
        cancelAnimationFrame(this.frame);
        for (const fn of this.cleanup)
            fn();
        this.model.dispose();
        this.gl.deleteProgram(this.program);
    }
}
