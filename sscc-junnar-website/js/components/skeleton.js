/**
 * SSCC Component: Skeleton Loader Helpers
 */
export function showTableSkeleton(tbodySelector, colCount = 5, rowCount = 3) {
  if (typeof document === 'undefined') return;
  const tbody = document.querySelector(tbodySelector);
  if (!tbody) return;
  
  let html = '';
  for (let i = 0; i < rowCount; i++) {
    html += '<tr>';
    for (let j = 0; j < colCount; j++) {
      html += '<td><div class="skeleton skeleton--text"></div></td>';
    }
    html += '</tr>';
  }
  tbody.innerHTML = html;
}
