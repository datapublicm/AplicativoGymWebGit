import { mountApp } from './app/App.js';
async function boot() {
    const root = document.querySelector('#root');
    if (!root)
        throw new Error('App root missing');
    try {
        const app = await mountApp(root, './models/human-muscle-v2.glb');
        window.__GYM_APP__ = app;
        window.__GYM_VIEWER__ = app.viewer;
        window.__GYM_VIEWER_READY__ = true;
        document.body.dataset.ready = 'true';
    }
    catch (error) {
        console.error(error);
        document.body.dataset.error = error instanceof Error ? error.message : String(error);
        throw error;
    }
}
void boot();
