import { LightningElement, track, wire } from 'lwc';
import getAccounts from '@salesforce/apex/DragDropView.getAccounts';

import getTruckList from '@salesforce/apex/DragDropView.getTruckList';
import { NavigationMixin } from 'lightning/navigation';

import getFulfillmentOrders from '@salesforce/apex/DeliveryDispatchFulfillment.getFulfillmentOrders';

import upsertDeliveryInfoFO from '@salesforce/apex/DeliveryDispatchFulfillment.upsertDeliveryInfoFO';

import updateFOToPending from '@salesforce/apex/DeliveryDispatchFulfillment.updateFOToPending';

import { refreshApex } from '@salesforce/apex';

import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class DeliveryDispatchFulfillmentOrder extends NavigationMixin(LightningElement) {
    draggedOrderId = null;

    countSelectedCheckbox = 0;
    selectedDate = null;
    selectedCustomer = null;
    countDraftFulfillments = 0;
    countConfirmedFulfillments = 0;
    countAllocatedFulfillments = 0;
    weekStart = "";
    weekEnd = "";

    showModal = false;

    flowName = "Delivery_Dispatch_AI_Scheduling";
    showFlow = false;
    flowInputs = [];

    orderColumns = [
        { label: 'Order Name', fieldName: 'name', type: 'text' },
        { label: 'Customer', fieldName: 'customer', type: 'text' },
        { label: 'Details', fieldName: 'productsRaw', type: 'text' }
    ];


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
                deliveryDate: date,
                trucks: [
                    {
                        truckId: truckId,
                        assignedFO: [orderObj.id]   // Apex expects Name
                    }
                ]
            }
        ];

        try {
            console.log("payload")
            console.log(JSON.stringify(payload))

            await upsertDeliveryInfoFO({ paramsJson: JSON.stringify(payload) });
            // await debugRaw({ paramsJson: JSON.stringify(payload) });

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
            t.assignedOrders.push({ ...orderObj, cssClass: "assigned-order" });
            orderObj.status = 'Assigned';
            orderObj.truckId = truckId;
            orderObj.deliveryDate = date;

            this.recalcTruckStatuses();
            this.showToast("Assigned truck in Salesforce", orderObj.name, "success")

        } catch (error) {
            console.error("Apex assign error", error);
            this.showToast("Error", error.body?.message || "Failed to assign", "error")
        }


    }

    handleCheckbox(event) {
        event.preventDefault();

        const order = this.orders.find(o => o.name === (event.target.dataset.name));
        order.checked = event.target.checked;

        if (order.checked) {
            // process to AI scheduling


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
            await updateFOToPending({ FOName: orderObj.name });

            const day = this.calendarData.find(d => d.date === date);
            const truck = day.trucks.find(t => t.truckId == truckId);

            truck.assignedOrders = truck.assignedOrders.filter(o => o.id !== orderId);

            orderObj.status = "Draft";
            orderObj.truckId = null;
            orderObj.deliveryDate = null;
            orderObj.cssClass = "draft-order";

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

        this.weekStart = monday.toISOString().slice(0, 10);

        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);

        this.weekEnd = friday.toISOString().slice(0, 10);

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
            const result = await getFulfillmentOrders();

            console.log('getFulfillmentOrders')
            console.log(result)

            this.orders = result.map((r) => {
                return {
                    id: r.Id,
                    name: r.Name,
                    customer: r.Order__r?.Account?.Abbreviation__c || '-',
                    productCode: "",
                    productName: "",
                    productFamily: "",
                    quantity: 0,
                    weight: r.Total_Weight__c,
                    status: r.Status__c,
                    truckId: r.Truck__c,
                    orderNumber: r.Order__r?.OrderNumber || '-',
                    deliveryDate: r.Delivery_Date__c,
                    products: r.Fulfillment_Order_Product_Items__r,
                    productsRaw: (r.Fulfillment_Order_Product_Items__r || [])
                        .map(p => `ProductCode: ${p.Product_Code__c} (Qty: ${p.Quantity__c})<br>` +
                            `Weight: ${p.Total_Weight__c}<br><br>`)
                        .join(', '),
                    checked: false,
                    url: '/' + r.Id,
                };
            });

            console.log("this.orders")
            console.log(this.orders)

            this.countDraftFulfillments = this.orders.filter((o) => o.status === 'Draft').length;
            this.countAssignedFulfillments = this.orders.filter((o) => o.status === 'Assigned').length;
            this.countConfirmedFulfillments = this.orders.filter((o) => o.status === 'Confirmed').length;
            this.countAllocatedFulfillments = this.orders.filter((o) => o.status === 'Allocated').length;
        } catch (error) {
            console.error('Order load error:', error);
            this.orders = [];
        }
    }

    rebuildAssignedOrdersIntoCalendar() {
        // Loop through all Assigned orders
        this.orders
            .filter(o => o.status !== 'Draft')
            .forEach(order => {
                // find calendar day
                const day = this.calendarData.find(d => d.date === order.deliveryDate);
                if (!day) return;

                // find the truck
                const truck = day.trucks.find(t => t.truckId === order.truckId);
                if (!truck) return;

                let cssClass = '';
                if (order.status === 'Draft') {
                    cssClass = 'draft-order';
                } else if (order.status === 'Assigned') {
                    cssClass = 'assigned-order';
                } else if (order.status === 'Confirmed') {
                    cssClass = 'confirmed-order';
                } else {
                    cssClass = 'allocated-order';
                }

                // push full object
                truck.assignedOrders.push({ ...order, cssClass: cssClass });
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

    get draftOrders() {
        console.log("draftorders get")
        console.log(this.orders)
        return this.orders?.filter(o => o.status === 'Draft') || [];
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

    get selectedOrders() {
        return this.orders.filter(o => o.checked);
    }

    openModal() {
        if (this.countSelectedCheckbox === 0) {
            this.showToast("Warning", "No orders selected", "warning");
            return;
        }
        this.showModal = true;
    }

    closeModal() {
        this.showModal = false;
    }

    confirmAISchedule() {
        // This is where you later call your AI scheduling logic
        console.log("Selected orders:", this.selectedOrders);
        console.log("Week:", this.weekStart, this.weekEnd);

        const weekStartDate = this.formatToDDMMYYYY(this.weekStart);
        const weekEndDate = this.formatToDDMMYYYY(this.weekEnd);
        const fulfillmentOrderProductItemIdList = this.selectedOrders
            .map(o => o.id) // or o.fulfillmentOrderProductItemId (your real field)
            .join(",");
        console.log("weekStartDate:", weekStartDate);
        console.log("weekEndDate:", weekEndDate);
        console.log("fulfillmentOrderProductItemIdList:", fulfillmentOrderProductItemIdList);


        this.showToast("AI Scheduling", "Processing selected orders...", "info");

        this.showModal = false;

        this.navigateToFlow(weekStartDate, weekEndDate, fulfillmentOrderProductItemIdList);

    }

    formatToDDMMYYYY(iso) {
        const [y, m, d] = iso.split("-");
        return `${d}/${m}/${y}`;
    }

    navigateToFlow(weekStartDate, weekEndDate, fulfillmentOrderProductItemIdList) {
        this.flowInputs = [
            { name: "weekStartDate", type: "String", value: weekStartDate },
            { name: "weekEndDate", type: "String", value: weekEndDate },
            { name: "fulfillmentOrderProductItemList", type: "String", value: fulfillmentOrderProductItemIdList }
        ];

        this.showFlow = true;

    }

    handleFlowStatus(event) {
        console.log("Flow status:", event.detail.status);

        if (event.detail.status === "FINISHED" || event.detail.status === "FINISHED_SCREEN") {
            this.showFlow = false;
            this.showToast("Success", "AI Scheduling completed", "success");
        }
    }

    get inputVariables() {
        return this.flowInputs;
    }

    handleRefresh() {
        window.location.reload();
    }
}