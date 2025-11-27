import { LightningElement, track, wire } from 'lwc';
import getAccounts from '@salesforce/apex/DragDropView.getAccounts';

export default class Scheduler extends LightningElement {
    draggedOrderId = null;
    countSelectedCheckbox = 0;
    selectedDate = null;
    selectedCustomer = null;

    @track accounts = [];
    @track error;

    @wire(getAccounts)
    wiredAccounts({ error, data }) {
        if (data) {
            this.accounts = data;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.accounts = [];
        }
    }



    @track orders = [
        {
            id: 1, name: 'FI-001',
            customer: 'FPFL000021',
            productCode: "FPFL000021",
            productName: "ใบเกลียวชุบแข็ง 152x34x144x3.2x59x700 L",
            quantity: 2, weight: 4000,
            checked: false,
        },
        {
            id: 2, name: 'FI-002',
            customer: 'FPFL000022',
            productCode: "FPFL000022",
            productName: "ใบเกลียวชุบแข็ง 152x34x144x3.2x59x800 L",
            quantity: 3, weight: 7000,
            checked: false
        },
        {
            id: 3, name: 'FI-003',
            customer: 'FPFL000023',
            productCode: "FPFL000023",
            productName: "ใบเกลียวชุบแข็ง 152x34x144x3.2x59x900 L",
            quantity: 4, weight: 7000,
            checked: false
        },
        {
            id: 4, name: 'FI-004',
            customer: 'FPFL000024',
            productCode: "FPFL000024",
            productName: "ใบเกลียวชุบแข็ง 152x34x144x3.2x59x1000 L",
            quantity: 5, weight: 7000,
            checked: false
        }
    ];

    @track calendarData = [
        {
            dayName: 'Monday',
            date: '2025-11-24',
            trucks: [
                { truckId: 1, capacity: 14000, assignedOrders: [] },
                { truckId: 2, capacity: 10000, assignedOrders: [] }
            ]
        },
        {
            dayName: 'Tuesday',
            date: '2025-11-25',
            trucks: [
                { truckId: 1, capacity: 14000, assignedOrders: [] }
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
        this.draggedOrderId = e.target.dataset.name;
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
        t.assignedOrders.push((orderId));
    }

    handleCheckbox(event) {
        event.preventDefault();

        const order = this.orders.find(o => o.name === (event.target.dataset.name));
        order.checked = event.target.checked;

        if (order.checked) {
            this.countSelectedCheckbox++;
        } else {
            this.countSelectedCheckbox--;
        }
    }

    handleRemove(e) {
        const orderId = (e.currentTarget.dataset.id);
        const truckId = parseInt(e.currentTarget.dataset.truckId);
        const date = e.currentTarget.dataset.date;

        const day = this.calendarData.find(d => d.date === date);
        const truck = day.trucks.find(t => t.truckId === truckId);

        truck.assignedOrders = truck.assignedOrders.filter(o => o !== orderId);
    }

    formatDateSG(dateValue) {
        const d = new Date(
            new Date(dateValue).toLocaleString("en-US", { timeZone: "Asia/Singapore" })
        );

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');

        return `${yyyy}-${mm}-${dd}`;
    }

    handleDateChange(event) {
        this.selectedDate = event.target.value;

        this.generateWeek(this.selectedDate);
    }

    getMonday(dateStr) {
        const d = new Date(dateStr);
        const day = d.getDay(); // 0=Sun
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(d.setDate(diff));
    }

    generateWeek(dateString) {
        const base = new Date(dateString);

        const dayOfWeek = base.getDay();
        // convert to Monday-based
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

        const monday = new Date(base);
        monday.setDate(base.getDate() + mondayOffset);

        const days = [];

        for (let i = 0; i < 5; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);

            const formatted = d.toISOString().slice(0, 10);

            days.push({
                date: formatted,
                label: d.toLocaleDateString('en-SG', { weekday: 'long' }),
                trucks: this.buildDefaultTrucks()   // your existing method or static list
            });
        }

        this.calendarData = days;
    }

    connectedCallback() {
        const today = new Date();
        this.selectedDate = today.toISOString().slice(0, 10);
        this.generateWeek(this.selectedDate);
    }

    buildDefaultTrucks() {
        return [
            { truckId: 'T1', capacity: 14000, assignedOrders: [] },
            { truckId: 'T2', capacity: 4200, assignedOrders: [] },
            { truckId: 'T3', capacity: 14000, assignedOrders: [] },
            { truckId: 'T4', capacity: 1500, assignedOrders: [] }
        ];
    }

    formatToSingapore(date) {
        return date.toLocaleDateString('en-SG', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    handleCustomerChange(event) {
        this.selectedCustomer = event.target.value;
    }



}
