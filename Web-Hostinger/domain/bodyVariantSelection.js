export async function requestBodyVariantChange(currentId, nextId, loader) {
  if (nextId === currentId) return currentId;
  try {
    await loader(nextId);
    return nextId;
  } catch {
    return currentId;
  }
}
