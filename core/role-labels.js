// Keep authorization identifiers separate from human-readable workspace labels.
export const ROLE_DISPLAY_NAMES = Object.freeze({
  ward: 'Ward',
  patrol: 'Patrol Night',
  maintenance: 'Maintenance',
});

export function roleDisplayName(role) {
  return ROLE_DISPLAY_NAMES[role] || String(role || '');
}

// Preserve real staff display names. Translate only the bare internal role ID.
export function roleAccountLabel(access = {}) {
  const role = access.role || '';
  const value = String(access.display_name || access.name || access.login_id || access.username || access.email || '').trim();
  return role === 'patrol' && (!value || value.toLowerCase() === 'patrol')
    ? roleDisplayName(role)
    : (value || roleDisplayName(role));
}
