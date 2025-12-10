public with sharing class DeliveryDispatchFulfillment {
    private class TruckDateInfo {
        private String truckId;
        private String deliveryDate;

        private TruckDateInfo(String truckId, String deliveryDate) {
            this.truckId = truckId;
            this.deliveryDate = deliveryDate;
        }
    }


    @AuraEnabled(cacheable=true)
    public static List<FulfillmentOrder__c> getFulfillmentOrders() {
        return [
            SELECT Id, Delivery_Date__c, 
            Name, No_of_Product_Items__c, Status__c, 
            Order__c, Total_Weight__c, Truck__c,
            Customer_No__c, CurrencyIsoCode,
            Order__r.Account.Name,
            Order__r.Account.Abbreviation__c,
            Order__r.Id,
            Order__r.OrderNumber,
            (
                SELECT 
                Id, Name, Quantity__c, Product_Code__c, 
                Total_Weight__c 
                FROM Fulfillment_Order_Product_Items__r
            )
            FROM FulfillmentOrder__c
            ORDER BY Name
        ];
    }

    @AuraEnabled
    public static void upsertDeliveryInfoFO(String paramsJson) {
        System.debug('params logs from Danny test here');
        System.debug(paramsJson);

        List<dtoUpsertDeliveryInfoFO> params =
        (List<dtoUpsertDeliveryInfoFO>) JSON.deserialize(
            paramsJson,
            List<dtoUpsertDeliveryInfoFO>.class
        );

        System.debug('setelah di deseralize');
        System.debug(params);


        Map<String, TruckDateInfo> productItemToTruckDateMap = new Map<String, TruckDateInfo>();

        for (dtoUpsertDeliveryInfoFO param : params) {
            for (dtoUpsertDeliveryInfoFO.clsTruck truck : param.trucks) {
                for (String productItemId : truck.assignedFO) {
                    productItemToTruckDateMap.put(
                        productItemId, 
                        new TruckDateInfo(truck.truckId, param.deliveryDate)
                    );
                }
            }
        }


        Set<String> productItemIds = productItemToTruckDateMap.keySet();

        List<FulfillmentOrder__c> foProductItems = [
            SELECT
            Id, Name
            FROM FulfillmentOrder__c
            WHERE Id IN :productItemIds
        ];

        for (FulfillmentOrder__c foProductItem : foProductItems) {
            TruckDateInfo truckDateInfo = productItemToTruckDateMap.get(foProductItem.Id);

            if (truckDateInfo == null) {
            continue;
            }

            foProductItem.Truck__c = truckDateInfo.truckId;
            foProductItem.Delivery_Date__c = Date.valueOf(truckDateInfo.deliveryDate);
            foProductItem.Status__c = 'Assigned';
        }

        if (!foProductItems.isEmpty()) {
            update foProductItems;
        }
    }


    @AuraEnabled
    public static void updateFOToPending(String FOName) {
        if (String.isBlank(FOName)) {
            return;
        }

        FulfillmentOrder__c FOtoUpdate = [
            SELECT Id, Name, Status__c, Truck__c, Delivery_Date__c
            FROM FulfillmentOrder__c WHERE Name = :FOName LIMIT 1
        ];

        if (FOName == null) {
            return;
        }

        FOtoUpdate.Truck__c = null;
        FOtoUpdate.Delivery_Date__c = null;
        FOtoUpdate.Status__c = 'Draft';
        update FOtoUpdate;
    }

}