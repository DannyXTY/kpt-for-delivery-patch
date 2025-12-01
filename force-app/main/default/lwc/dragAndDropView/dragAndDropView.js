import { LightningElement, track, wire } from 'lwc';
import getAccounts from '@salesforce/apex/DragDropView.getAccounts';
import getPendingFulfillmentOrderProductItems from '@salesforce/apex/DragDropView.getPendingFulfillmentOrderProductItems';
import getAssignedFulfillmentOrderProductItems from '@salesforce/apex/DragDropView.getAssignedFulfillmentOrderProductItems';
import getFulfillmentOrderProductItems from '@salesforce/apex/DragDropView.getFulfillmentOrderProductItems';
import getTruckList from '@salesforce/apex/DragDropView.getTruckList';
import getFOPI from '@salesforce/apex/DragDropView.getFOPI';

import upsertDeliveryInfoFOProductItem from '@salesforce/apex/Integration.upsertDeliveryInfoFOProductItem';

import { ShowToastEvent } from 'lightning/platformShowToastEvent';


export default class dragAndDropView extends LightningElement {
    draggedOrderId = null;

    countSelectedCheckbox = 0;
    selectedDate = null;
    selectedCustomer = null;
    countPendingFulfillments = 0;
    weekStart = "";
    weekEnd = "";

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
    example orders
    @track orders = [
        {
            id: 1, name: 'FI-001',
            customer: 'FPFL000021',
            productCode: "FPFL000021",
            productName: "ใบเกลียวชุบแข็ง 152x34x144x3.2x59x700 L",
            quantity: 2, weight: 4000,
            checked: false,
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

    async assignOrder(orderId, truckId, date) {
        const orderObj = this.orders.find(o => o.id == orderId || o.name == orderId);

        if (!orderObj) {
            console.error('Order not found:', orderId);
            return;
        }

        const payload = [
            {
                deliveryDate: orderObj.deliveryDate,
                trucks: [
                    {
                        truckId: orderObj.truckId,
                        assignedFOProductItem: [orderObj.name]   // Apex expects Name
                    }
                ]
            }
        ];

        try {
            console.log("Assigned updated in Salesforce:", orderObj.name);

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
            orderObj.status = 'Assigned';
            orderObj.truckId = truckId;
            orderObj.deliveryDate = date;

            this.recalcTruckStatuses();
            showToast("Assigned truck in Salesforce", orderObj.name, "success")

        } catch (error) {
            console.error("Apex assign error", err);
            showToast("Error", err.body?.message || "Failed to assign", "error")

        }


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

    async handleRemove(e) {
        const orderId = (e.currentTarget.dataset.id);
        const truckId = e.currentTarget.dataset.truckId;
        const date = e.currentTarget.dataset.date;

        const orderObj = this.orders.find(o => o.id == orderId);
        if (!orderObj) return;

        try {

            const day = this.calendarData.find(d => d.date === date);
            const truck = day.trucks.find(t => t.truckId == truckId);

            truck.assignedOrders = truck.assignedOrders.filter(o => o.id !== orderId);

            orderObj.status = "Pending";
            orderObj.truckId = null;
            orderObj.deliveryDate = null;

            this.recalcTruckStatuses();
            this.showToast("Success", "Removed from Truck", "success");
        } catch (error) {
            console.error("Remove failed:", error);
            this.showToast("Error", error.body?.message || "Failed to remove", "error");
        }
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
            const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });

            days.push({
                dayName: dayName,
                date: formatted,
                label: d.toLocaleDateString('en-SG', { weekday: 'long' }),
                trucks: this.buildDefaultTrucks()   // your existing method or static list
            });
        }

        this.calendarData = days;
        this.recalcTruckStatuses();
        this.rebuildAssignedOrdersIntoCalendar();
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
                    truckId: r.Truck__c,
                    deliveryDate: r.Delivery_Date__c,
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

    rebuildAssignedOrdersIntoCalendar() {
        // Loop through all Assigned orders
        this.orders
            .filter(o => o.status === 'Assigned')
            .forEach(order => {
                // find calendar day
                const day = this.calendarData.find(d => d.date === order.deliveryDate);
                if (!day) return;

                // find the truck
                const truck = day.trucks.find(t => t.truckId === order.truckId);
                if (!truck) return;

                // push full object
                truck.assignedOrders.push({ ...order });
            });

        this.recalcTruckStatuses();
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
                remainingCapacity: data.Total_Weight_Allowed__c,
                tooltip: `${data.Name} (Max Capacity: ${data.Total_Weight_Allowed__c} kg)`,
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
                const remaining = capacity - total;

                const ratio = capacity > 0 ? total / capacity : 0;
                let statusClass = 'truck-capacity under-capacity';
                if (ratio > 1) statusClass = 'truck-capacity at-capacity';
                else if (ratio >= 0.8) statusClass = 'truck-capacity near-capacity';

                // optional: percent used for capacity bar
                const capacityPct = Math.min(100, Math.round((capacity > 0 ? (total / capacity) * 100 : 0)));

                return {
                    ...t,
                    totalWeight: total,
                    remainingCapacity: remaining,
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

    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title: title,
            message: message,
            variant: variant
        });
        this.dispatchEvent(event);
    }
}
