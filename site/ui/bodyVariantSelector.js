import { BODY_VARIANTS } from '../domain/bodyVariants.js';

export function createBodyVariantSelector(container, { initialId, onChange }) {
  let currentId = initialId;
  let pending = false;

  container.classList.add('body-variant-selector');
  container.dataset.testid = 'body-variant-selector';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Modelo corporal');

  const buttons = new Map();

  const renderState = () => {
    for (const [id, button] of buttons) {
      button.setAttribute('aria-pressed', String(id === currentId));
      button.disabled = pending;
    }
    container.dataset.bodyVariant = currentId;
    container.dataset.loading = String(pending);
  };

  for (const variant of Object.values(BODY_VARIANTS)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'body-variant-button';
    button.dataset.bodyVariant = variant.id;
    button.textContent = variant.label;
    buttons.set(variant.id, button);
    container.append(button);
  }

  const handlers = [];
  for (const [id, button] of buttons) {
    const handler = async () => {
      if (pending || id === currentId) return;
      pending = true;
      renderState();
      try {
        const effectiveId = await onChange(id);
        if (BODY_VARIANTS[effectiveId]) currentId = effectiveId;
      } finally {
        pending = false;
        renderState();
      }
    };
    button.addEventListener('click', handler);
    handlers.push(() => button.removeEventListener('click', handler));
  }

  renderState();

  return {
    getSelected() { return currentId; },
    setSelected(id) {
      if (!BODY_VARIANTS[id]) throw new Error(`Unknown body variant: ${id}`);
      currentId = id;
      renderState();
    },
    dispose() {
      for (const dispose of handlers) dispose();
      container.replaceChildren();
    },
  };
}
