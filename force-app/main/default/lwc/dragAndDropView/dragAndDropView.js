import { LightningElement, track } from 'lwc';

export default class Scheduler extends LightningElement {
    draggedOrderId = null;

    @track orders = [
        {
            id: 1, name: 'FI-001',
            customer: 'FPFL000021',
            productCode: "FPFL000021",
            productName: "ใบเกลียวชุบแข็ง 152x34x144x3.2x59x700 L",
            quantity: 2, weight: 4000
        },
        {
            id: 2, name: 'FI-002',
            customer: 'FPFL000022',
            productCode: "FPFL000022",
            productName: "ใบเกลียวชุบแข็ง 152x34x144x3.2x59x800 L",
            quantity: 3, weight: 7000
        },
        {
            id: 3, name: 'FI-003',
            customer: 'FPFL000023',
            productCode: "FPFL000023",
            productName: "ใบเกลียวชุบแข็ง 152x34x144x3.2x59x900 L",
            quantity: 4, weight: 7000
        },
        {
            id: 4, name: 'FI-004',
            customer: 'FPFL000024',
            productCode: "FPFL000024",
            productName: "ใบเกลียวชุบแข็ง 152x34x144x3.2x59x1000 L",
            quantity: 5, weight: 7000
        }
    ];

    @track calendarData = [
        {
            dayName: 'Monday',
            date: '2025-11-24',
            trucks: [
                { truckId: 1, capacity: 14000, assignedOrders: [1] },
                { truckId: 2, capacity: 10000, assignedOrders: [] }
            ]
        },
        {
            dayName: 'Tuesday',
            date: '2025-11-25',
            trucks: [
                { truckId: 1, capacity: 14000, assignedOrders: [2] }
            ]
        },
        {
            dayName: 'Wednesday',
            date: '2025-11-26',
            trucks: []
        },
        {
            dayName: 'Thursday',
            date: '2025-11-27',
            trucks: []
        },
        {
            dayName: 'Friday',
            date: '2025-11-28',
            trucks: []
        }
    ];

    handleDragStart(e) {
        this.draggedOrderId = e.target.dataset.id;
        e.dataTransfer.setData('text/plain', this.draggedOrderId);
    }

    handleDragOver(e) {
        e.preventDefault();
    }

    handleDrop(e) {
        e.preventDefault();

        const orderId = e.dataTransfer.getData('text/plain');
        const truckId = e.currentTarget.dataset.truckId;
        const date = e.currentTarget.dataset.date;

        this.assignOrder(orderId, truckId, date);
    }

    assignOrder(orderId, truckId, date) {
        // Remove from any truck
        this.calendarData.forEach(day => {
            day.trucks.forEach(t => {
                t.assignedOrders = t.assignedOrders.filter(o => o != orderId);
            });
        });

        // Assign to new truck
        const day = this.calendarData.find(d => d.date === date);
        const t = day.trucks.find(t => t.truckId == truckId);
        t.assignedOrders.push(parseInt(orderId));
    }
}
