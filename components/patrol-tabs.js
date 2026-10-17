/**
 * Source-defined Patrol primary tabs.
 * This component owns only tab selection/keyboard semantics. Page-specific
 * loading and consequences stay in the Patrol page modules.
 */
export function initPatrolTabs({ root = document, initialTab = 'submission', onChange } = {}) {
  const buttons = [...root.querySelectorAll('[data-patrol-tab]')];
  const panels = [...root.querySelectorAll('[data-patrol-tab-panel]')];
  let activeTab = initialTab;

  function select(tab, { focus = false, emit = true } = {}) {
    if (!buttons.some(button => button.dataset.patrolTab === tab)) return false;
    activeTab = tab;
    buttons.forEach(button => {
      const active = button.dataset.patrolTab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus();
    });
    panels.forEach(panel => {
      const active = panel.dataset.patrolTabPanel === tab;
      panel.hidden = !active;
    });
    if (emit) {
      onChange?.(tab);
      document.dispatchEvent(new CustomEvent('patrol-primary-tab-change', { detail: { tab } }));
    }
    return true;
  }

  buttons.forEach((button, index) => {
    button.setAttribute('role', 'tab');
    button.addEventListener('click', () => {
      if (!button.disabled) select(button.dataset.patrolTab);
    });
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const enabled = buttons.filter(item => !item.disabled);
      if (!enabled.length) return;
      let next = enabled.indexOf(button);
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = enabled.length - 1;
      else next = (next + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length;
      select(enabled[next].dataset.patrolTab, { focus: true });
    });
    button.id ||= `patrolPrimaryTab${index + 1}`;
  });

  panels.forEach(panel => {
    const button = buttons.find(item => item.dataset.patrolTab === panel.dataset.patrolTabPanel);
    if (button) {
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', button.id);
    }
  });

  function setEnabled(enabled) {
    buttons.forEach(button => { button.disabled = !enabled; });
  }

  select(initialTab, { emit: false });
  return { select, setEnabled, get activeTab() { return activeTab; } };
}
