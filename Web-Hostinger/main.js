import { mountApp } from './app/App.js?v=0.5.2';
import { DEFAULT_BODY_VARIANT } from './domain/bodyVariants.js?v=0.5.2';
async function boot() {
    const root = document.querySelector('#root');
    if (!root)
        throw new Error('App root missing');
    try {
        const app = await mountApp(root, DEFAULT_BODY_VARIANT);
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
