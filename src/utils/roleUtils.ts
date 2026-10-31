/**
 * Homologación y Validación Universal de Roles en Lidacta.
 * Garantiza detección exhaustiva de Recursos Humanos en cualquier variante:
 * 'HR', 'RH', 'hr', 'rh', 'RECURSOS_HUMANOS', 'recursos_humanos', 'Recursos Humanos', etc.
 */

export function isHumanResourcesRole(role?: string | null): boolean {
  if (!role) return false;
  const r = String(role).trim().toUpperCase();
  return (
    r === 'HR' ||
    r === 'RH' ||
    r === 'RECURSOS_HUMANOS' ||
    r === 'RECURSOS HUMANOS' ||
    r === 'RECURSOSHUMANOS' ||
    r === 'HUMAN_RESOURCES' ||
    r === 'HUMAN RESOURCES' ||
    r === 'HUMANRESOURCES' ||
    r === 'TALENTO' ||
    r.startsWith('HR') ||
    r.startsWith('RH') ||
    r.includes('RECURSOS') ||
    r.includes('TALENTO')
  );
}

export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const r = String(role).trim().toUpperCase();
  return r === 'ADMIN' || r === 'ADMINISTRADOR' || r === 'ADMINISTRADORA';
}

export function isLeaderRole(role?: string | null): boolean {
  if (!role) return true;
  if (isHumanResourcesRole(role) || isAdminRole(role)) return false;
  return true;
}

export function normalizeRole(role?: string | null): 'admin' | 'hr' | 'leader' {
  if (isAdminRole(role)) return 'admin';
  if (isHumanResourcesRole(role)) return 'hr';
  return 'leader';
}

export function getRoleDisplayName(role?: string | null): string {
  if (isAdminRole(role)) return 'Administradora';
  if (isHumanResourcesRole(role)) return 'Recursos Humanos';
  return 'Líder';
}
