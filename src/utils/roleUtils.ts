/**
 * Homologación y Validación Universal de Roles en Lidacta.
 * Vinculado estrictamente al campo "ROL EN LA PLATAFORMA" seleccionado
 * en los botones de registro ('Líder' / 'Recursos Humanos').
 * Ignora por completo el texto libre del campo "Puesto / Cargo".
 */

export function isHumanResourcesRole(role?: string | null): boolean {
  if (!role) return false;
  const r = String(role).trim().toLowerCase();
  return (
    r === 'hr' ||
    r === 'rh' ||
    r === 'recursos_humanos' ||
    r === 'recursos humanos' ||
    r === 'recursoshumanos' ||
    r === 'human_resources' ||
    r === 'human resources' ||
    r === 'humanresources' ||
    r.startsWith('hr') ||
    r.startsWith('rh') ||
    r.includes('recursos_humanos') ||
    r.includes('recursos humanos')
  );
}

export function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const r = String(role).trim().toLowerCase();
  return r === 'admin' || r === 'administrador' || r === 'administradora';
}

export function isLeaderRole(role?: string | null): boolean {
  if (!role) return true;
  const r = String(role).trim().toLowerCase();
  return (
    r === 'leader' ||
    r === 'lider' ||
    r === 'líder' ||
    (!isHumanResourcesRole(role) && !isAdminRole(role))
  );
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
