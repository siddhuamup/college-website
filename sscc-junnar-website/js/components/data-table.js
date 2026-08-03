/**
 * SSCC Component: Sortable & Filterable Data Table Component
 */
export class DataTable {
  static makeSortable(tableId) {
    if (typeof document === 'undefined') return;
    const table = document.getElementById(tableId);
    if (!table) return;

    const headers = table.querySelectorAll('th');
    headers.forEach((header, index) => {
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => this.sortTable(table, index));
    });
  }

  static sortTable(table, colIndex) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const isAscending = table.getAttribute(`data-sort-col-${colIndex}`) !== 'asc';

    rows.sort((a, b) => {
      const cellA = a.children[colIndex]?.textContent.trim().toLowerCase() || '';
      const cellB = b.children[colIndex]?.textContent.trim().toLowerCase() || '';
      return isAscending ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
    });

    table.setAttribute(`data-sort-col-${colIndex}`, isAscending ? 'asc' : 'desc');
    tbody.innerHTML = '';
    rows.forEach(r => tbody.appendChild(r));
  }
}
