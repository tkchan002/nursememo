// Shared layout step for Ward Memo NIL tables. The SVGs start at height zero
// in the document HTML; size them after table layout so the X spans only the
// tbody, not the column headings. Used by both iframe preview and print.html.
export function positionWardMemoCrosses(root) {
  if (!root?.querySelectorAll) return false;
  const view = root.defaultView || root.ownerDocument?.defaultView;
  for (const box of root.querySelectorAll('.memo-table-box.crossed')) {
    const table = box.querySelector('table');
    const cross = box.querySelector('.memo-cross-body');
    if (!table || !cross) continue;
    const tbody = table.tBodies?.[0];
    if (!tbody?.rows?.length) {
      cross.style.display = 'none';
      continue;
    }
    const marginTop = view ? parseFloat(view.getComputedStyle(table).marginTop) || 0 : 0;
    const headerHeight = table.tHead?.offsetHeight || 0;
    const bodyHeight = tbody.offsetHeight;
    cross.style.top = `${marginTop + headerHeight}px`;
    cross.style.height = `${bodyHeight}px`;
    // The real cross is not visible until the table has a measurable body.
    // Reset an old display:none left by a temporarily empty tbody.
    cross.style.display = bodyHeight > 0 ? 'block' : 'none';
  }
  return true;
}
