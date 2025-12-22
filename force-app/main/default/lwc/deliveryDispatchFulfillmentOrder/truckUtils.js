// truckUtils.js
export function calculateTruckStatus(truck, orders) {
    const total = (truck.assignedOrders || []).reduce((sum, o) => {
        const weight =
            o?.weight ??
            orders.find(x => x.id === o || x.name === o)?.weight ??
            0;
        return sum + weight;
    }, 0);

    const remaining = truck.capacity - total;
    const ratio = truck.capacity > 0 ? total / truck.capacity : 0;

    let statusClass = 'truck-capacity under-capacity';
    if (ratio > 1) statusClass = 'truck-capacity at-capacity';
    else if (ratio >= 0.8) statusClass = 'truck-capacity near-capacity';

    return {
        ...truck,
        totalWeight: total,
        remainingCapacity: remaining,
        capacityPct: Math.min(100, Math.round((total / truck.capacity) * 100)),
        statusClass,
        isEmpty: (truck.assignedOrders || []).length === 0
    };
}
