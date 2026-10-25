
const ALLOWED_PROTOCOLS = new Set(['https:', 'http:']);

/**
 * Valida a URL recebida antes de carregá-la no player.
 * Não é um filtro de anúncios por domínio.
 */
export function getSafePlayerUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return '';
  }

  try {
    const url = new URL(value.trim(), window.location.origin);

    if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
      console.warn('[VORTEX Shield] Protocolo bloqueado:', url.protocol);
      return '';
    }

    // Não permite credenciais embutidas na URL.
    if (url.username || url.password) {
      console.warn('[VORTEX Shield] URL com credenciais bloqueada.');
      return '';
    }

    return url.href;
  } catch {
    console.warn('[VORTEX Shield] URL inválida bloqueada.');
    return '';
  }
}

/**
 * Restrições iniciais para o player externo.
 *
 * Não permite pop-ups, formulários nem navegação do documento
 * principal iniciada pelo conteúdo do iframe.
 *
 * O player pode precisar de permissões adicionais para funcionar.
 */
export const PLAYER_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation allow-orientation-lock allow-pointer-lock';

export const PLAYER_ALLOW =
  'autoplay; encrypted-media; fullscreen; picture-in-picture';

/**
 * Configuração padrão do VORTEX Shield.
 * Modo rigoroso desativado.
 */
export const VORTEX_SHIELD_CONFIG = Object.freeze({
  enabled: true,
  strictMode: false,
  blockPopups: true,
  validatePlayerUrls: true,
});

export function logShieldEvent(message) {
  if (VORTEX_SHIELD_CONFIG.enabled) {
    console.info(`[VORTEX Shield] ${message}`);
  }
}
