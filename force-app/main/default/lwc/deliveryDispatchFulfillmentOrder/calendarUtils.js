// calendarUtils.js
export function buildWeek(monday, truckFactory) {
    const days = [];

    for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);

        days.push({
            dayName: d.toLocaleDateString('en-US', { weekday: 'long' }),
            date: d.toISOString().slice(0, 10),
            trucks: truckFactory()
        });
    }

    return days;
}
