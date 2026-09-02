import type { Usuario } from '@/lib/api';

// ================================================================
// NÍVEIS DE ACESSO DO LOGYM
//
// O backend atual usa:
// USER    -> usuário comum
// MANAGER -> gerente
// ADMIN   -> administrador
//
// Mantemos alguns aliases por compatibilidade para evitar que um
// texto antigo como "GERENTE" faça o Mobile montar o menu errado.
// ================================================================

export type NivelAcessoNormalizado =
  | 'USER'
  | 'MANAGER'
  | 'ADMIN'
  | string;

function extrairNivelAcesso(
  usuarioOuNivel?: Usuario | string | null
) {
  if (typeof usuarioOuNivel === 'string') {
    return usuarioOuNivel;
  }

  return usuarioOuNivel?.nivelAcesso || '';
}

export function normalizarNivelAcesso(
  usuarioOuNivel?: Usuario | string | null
): NivelAcessoNormalizado {
  const nivel = String(extrairNivelAcesso(usuarioOuNivel))
    .trim()
    .toUpperCase();

  if (!nivel || nivel === 'USER' || nivel === 'USUARIO' || nivel === 'USUÁRIO') {
    return 'USER';
  }

  if (nivel === 'MANAGER' || nivel === 'GERENTE') {
    return 'MANAGER';
  }

  if (nivel === 'ADMIN' || nivel === 'ADMINISTRADOR') {
    return 'ADMIN';
  }

  return nivel;
}

export function ehUsuarioComum(
  usuarioOuNivel?: Usuario | string | null
) {
  return normalizarNivelAcesso(usuarioOuNivel) === 'USER';
}

export function ehGerente(
  usuarioOuNivel?: Usuario | string | null
) {
  return normalizarNivelAcesso(usuarioOuNivel) === 'MANAGER';
}

export function ehAdmin(
  usuarioOuNivel?: Usuario | string | null
) {
  return normalizarNivelAcesso(usuarioOuNivel) === 'ADMIN';
}

export function ehAdministrativo(
  usuarioOuNivel?: Usuario | string | null
) {
  const nivel = normalizarNivelAcesso(usuarioOuNivel);
  return nivel === 'MANAGER' || nivel === 'ADMIN';
}
