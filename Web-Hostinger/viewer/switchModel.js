import { loadHumanModel } from './loadHumanModel.js';

export async function switchViewerModel(viewer, modelUrl, loader = loadHumanModel) {
  const newModel = await loader(viewer.gl, modelUrl);
  try {
    viewer.replaceModel(newModel);
  } catch (error) {
    newModel.dispose?.();
    throw error;
  }
}
