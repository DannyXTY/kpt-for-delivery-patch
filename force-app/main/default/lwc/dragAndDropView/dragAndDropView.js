import { LightningElement, track, wire } from 'lwc';
import getAccounts from '@salesforce/apex/DragDropView.getAccounts';
import getPendingFulfillmentOrderProductItems from '@salesforce/apex/DragDropView.getPendingFulfillmentOrderProductItems';
import getAssignedFulfillmentOrderProductItems from '@salesforce/apex/DragDropView.getAssignedFulfillmentOrderProductItems';
import getFulfillmentOrderProductItems from '@salesforce/apex/DragDropView.getFulfillmentOrderProductItems';
import getTruckList from '@salesforce/apex/DragDropView.getTruckList';
import getFOPI from '@salesforce/apex/DragDropView.getFOPI';

export default class dragAndDropView extends LightningElement {
    draggedOrderId = null;

    countSelectedCheckbox = 0;
    selectedDate = null;
    selectedCustomer = null;
    countPendingFulfillments = 0;

    @track accounts = [];
    @track accountError;
    @track truckList = [];
    @track truckListError;

    @track orders = [];

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

    /*
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
            quantity: 4, weight: 1000,
            checked: false
        },
        {
            id: 4, name: 'FI-004',
            customer: 'FPFL000024',
            productCode: "FPFL000024",
            productName: "ใบเกลียวชุบแข็ง 152x34x144x3.2x59x1000 L",
            quantity: 5, weight: 1000,
            checked: false
        },
        {
            id: 5, name: 'FI-005',
            customer: 'FPFL000025',
            productCode: "FPFL000025",
            productName: "ใบเกลียวชุบแข็ง 152x34x144x3.3x59x1000 L",
            quantity: 5, weight: 1000,
            checked: false
        }
    ];
    */

    @track calendarData = [
        {
            dayName: 'Monday',
            date: '2025-11-24',
            trucks: [
                { truckId: "T1", capacity: 10000, assignedOrders: [] },
                { truckId: "T2", capacity: 10000, assignedOrders: [] }
            ]
        },
        {
            dayName: 'Tuesday',
            date: '2025-11-25',
            trucks: [
                { truckId: "T1", capacity: 14000, assignedOrders: [] }
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
        const orderObj = this.orders.find(o => o.id == orderId || o.name == orderId);

        if (!orderObj) {
            console.error('Order not found:', orderId);
            return;
        }

        // Clean previous assignments
        this.calendarData.forEach(day => {
            day.trucks.forEach(t => {
                t.assignedOrders = t.assignedOrders.filter(o => o.id !== orderObj.id);
            });
        });

        // Assign to new truck
        const day = this.calendarData.find(d => d.date === date);
        const t = day.trucks.find(t => t.truckId == truckId);

        // Push full object, not ID
        t.assignedOrders.push({ ...orderObj });
        this.recalcTruckStatuses();
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
        const truckId = e.currentTarget.dataset.truckId;
        const date = e.currentTarget.dataset.date;

        const day = this.calendarData.find(d => d.date === date);
        const truck = day.trucks.find(t => t.truckId == truckId);

        truck.assignedOrders = truck.assignedOrders.filter(o => o.id !== orderId);
        this.recalcTruckStatuses();
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
        this.recalcTruckStatuses();
    }

    async connectedCallback() {
        const today = new Date();
        this.selectedDate = today.toISOString().slice(0, 10);

        await this.fetchTruckList();
        await this.fetchfulfillmentOrderProductItemList();

        this.generateWeek(this.selectedDate);
    }

    async fetchfulfillmentOrderProductItemList() {
        try {
            const result = await getFulfillmentOrderProductItems();

            this.orders = result.map((r) => {
                return {
                    id: r.Id,
                    name: r.Name,
                    customer: r.Customer__c,
                    productCode: r.Product__r.ProductCode,
                    productName: r.Product__r.Name,
                    productFamily: r.Product__r.Family,
                    quantity: r.Quantity__c,
                    weight: r.Total_Weight__c,
                    status: r.Status__c,
                    checked: false,
                };
            });

            this.countPendingFulfillments = this.orders.filter((o) => o.status === 'Pending').length;
            this.countAssignedFulfillments = this.orders.filter((o) => o.status === 'Assigned').length;

        } catch (error) {
            console.error('Order load error:', error);
            this.orders = [];
        }
    }

    async fetchTruckList() {
        try {
            this.truckList = await getTruckList();
        } catch (error) {
            console.error('Truck load error:', error);
            this.truckList = [];
        }
    }


    buildDefaultTrucks() {

        let buildTrucks = [];
        this.truckList.map((data) => {
            buildTrucks.push({
                truckId: data.Id,
                truckName: data.Name,
                capacity: data.Total_Weight_Allowed__c,
                assignedOrders: []
            })
        })



        return buildTrucks;
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


    recalcTruckStatuses() {
        this.calendarData = this.calendarData.map(day => {
            const trucks = day.trucks.map(t => {
                // sum weights (assignedOrders might be objects or ids — handle both)
                const total = (t.assignedOrders || []).reduce((sum, o) => {
                    // if object with weight, use it; if ID or string, find from orders
                    const weight = (o && typeof o === 'object' && o.weight)
                        ? o.weight
                        : (() => {
                            const found = this.orders.find(x => x.id == o || x.name == o);
                            return found ? found.weight : 0;
                        })();
                    return sum + weight;
                }, 0);

                const capacity = t.capacity || 0;
                const ratio = capacity > 0 ? total / capacity : 0;
                let statusClass = 'truck-capacity under-capacity';
                if (ratio > 1) statusClass = 'truck-capacity at-capacity';
                else if (ratio >= 0.8) statusClass = 'truck-capacity near-capacity';

                // optional: percent used for capacity bar
                const capacityPct = Math.min(100, Math.round((capacity > 0 ? (total / capacity) * 100 : 0)));

                return {
                    ...t,
                    totalWeight: total,
                    capacityPct,
                    statusClass,
                    isEmpty: (t.assignedOrders || []).length === 0
                };
            });

            return {
                ...day,
                trucks
            };
        });
    }


    get pendingOrders() {
        return this.orders?.filter(o => o.status === 'Pending') || [];
    }

    get assignedOrders() {
        return this.orders?.filter(o => o.status === 'Assigned') || [];
    }


}
