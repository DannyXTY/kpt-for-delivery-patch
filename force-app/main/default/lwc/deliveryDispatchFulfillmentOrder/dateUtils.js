// dateUtils.js
export function getMonday(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}

export function toISO(date) {
    return date.toISOString().slice(0, 10);
}

export function formatToDDMMYYYY(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}
