/**
 * Solo se permite un retorno HTTPS configurado por el responsable del despliegue.
 * No usa window.location ni valores introducidos por el usuario como destino.
 */
export function resolveRecoveryUrl(configured) {
  if (!configured || typeof configured !== 'string') return null;
  try {
    const url = new URL(configured.trim());
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
      ['localhost', '127.0.0.1', '[::1]', '::1'].includes(url.hostname.toLowerCase())) return null;
    if (url.search || url.hash) return null;
    return url.href;
  } catch {
    return null;
  }
}
