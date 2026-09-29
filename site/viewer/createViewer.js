import { loadHumanModel } from './loadHumanModel.js';
import { ViewerController } from './ViewerController.js';
export async function createViewer(container, modelUrl) {
    const canvas = document.createElement('canvas');
    canvas.dataset.testid = 'viewer-canvas';
    canvas.className = 'viewer-canvas';
    container.replaceChildren(canvas);
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
    if (!gl)
        throw new Error('WebGL unavailable');
    const model = await loadHumanModel(gl, modelUrl);
    return new ViewerController(canvas, gl, model);
}
