/**
 * Homologación y Validación Universal de Roles en Lidacta.
 * Vinculado estrictamente al campo "ROL EN LA PLATAFORMA" seleccionado
 * en los botones de registro ('Líder' / 'Recursos Humanos').
 * Ignora por completo el texto libre del campo "Puesto / Cargo".
 */

export function normalizeRoleString(roleValue?: string | null): string {
  return (roleValue || '')
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function isHumanResourcesRole(role?: string | null): boolean {
  if (!role) return false;
  const r = normalizeRoleString(role);
  return (
    r.includes('hr') ||
    r.includes('rh') ||
    r.includes('recursos') ||
    r.includes('human_resources') ||
    r.includes('human resources')
  );
}

export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const r = normalizeRoleString(role);
  return r === 'admin' || r === 'administrador' || r === 'administradora';
}

export function isLeaderRole(role?: string | null): boolean {
  if (!role) return true;
  const r = normalizeRoleString(role);
  if (
    r.includes('leader') ||
    r.includes('lider') ||
    r.includes('leader_role')
  ) {
    return true;
  }
  return !isHumanResourcesRole(role) && !isAdminRole(role);
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
