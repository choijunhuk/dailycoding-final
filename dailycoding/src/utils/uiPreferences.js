export function applyUiPreferenceFlags(ui = {}) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-animations', ui.animations === false ? 'false' : 'true');
  root.setAttribute('data-compact', ui.compactMode ? 'true' : 'false');
  root.setAttribute('data-sidebar-collapsed', ui.autoCollapseSidebar ? 'true' : 'false');
}
