public with sharing class DeliveryDispatchFulfillment {
    private class TruckDateInfo {
        private String truckId;
        private String deliveryDate;

        private TruckDateInfo(String truckId, String deliveryDate) {
            this.truckId = truckId;
            this.deliveryDate = deliveryDate;
        }
    }

    @AuraEnabled(cacheable=false)
    public static List<Fulfillment_AI_Scheduling_Log__c> getAiSchedulingLog(
        Id schedulingLogId
    ) {
        return [
            SELECT Id, Name, Status__c, Summary_Assigned_Count__c,
            Summary_Notes__c, Summary_Total_Items__c, Summary_Unassigned_Count__c,
            Week_End_Date__c, Week_Start_Date__c
            FROM Fulfillment_AI_Scheduling_Log__c
            WHERE Id = :schedulingLogId
            ORDER BY CreatedDate ASC
        ];
    }

    @AuraEnabled(cacheable=false)
    public static List<Fulfillment_AI_Scheduling_Log_Item__c> getSchedulingLogItems(
        Id schedulingLogId
    ) {
        return [
            SELECT Id, Name, Fulfillment_Order__c, Recommendation_Reason__c,
            Recommendation_Status__c, Recommendation_Suggestion__c, Recommended_Delivery_Date__c,
            Recommended_Truck__c, Fulfillment_AI_Scheduling_Log__c
            FROM Fulfillment_AI_Scheduling_Log_Item__c
            WHERE Fulfillment_AI_Scheduling_Log__c = :schedulingLogId
            ORDER BY CreatedDate ASC
        ];
    }

    @AuraEnabled(cacheable=false)
    public static List<Fulfillment_AI_Delivery_Condition_Item__c> getDeliveryConditionItems(
        Id schedulingLogId
    ) {
        return [
            SELECT Id, Name, Fulfillment_AI_Scheduling_Log__c, Fulfillment_AI_Scheduling_Log_Item__c,
            Delivery_Condition__c, Delivery_Condition_Reason__c, Delivery_Condition_Status__c,
            Delivery_Condition_Suggestion__c
            FROM Fulfillment_AI_Delivery_Condition_Item__c
            WHERE Fulfillment_AI_Scheduling_Log__c = :schedulingLogId
            ORDER BY CreatedDate ASC
        ];
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

    @AuraEnabled(cacheable=true)
    public static List<FulfillmentOrder__c> getFilteredFulfillmentOrders(
        String customerId,
        Date startDate,
        Date endDate
    ) {
        String baseQuery = 
            'SELECT Id, Name, Status__c, Delivery_Date__c, Total_Weight__c,' +
            '       Truck__c, Order__r.Id, Order__r.Account.Abbreviation__c,' + 
            '       Order__r.OrderNumber, Order__r.Account.Name, Customer_No__c, Order__r.EffectiveDate, ' +
            '       CurrencyIsoCode, No_of_Product_Items__c, ' +
            '       (SELECT Id, Name, Product_Code__c, Quantity__c, Total_Weight__c, Product__r.Name FROM Fulfillment_Order_Product_Items__r)' +
            ' FROM FulfillmentOrder__c WHERE (Order__r.EffectiveDate <= :endDate OR Order__r.EffectiveDate = NULL) ';

        if (customerId != null && customerId != 'all') {
            baseQuery += ' AND Order__r.AccountId = :customerId';
        }

        baseQuery += ' ORDER BY CreatedDate DESC';
        return Database.query(baseQuery);
    }

    @AuraEnabled(cacheable=true)
    public static List<Fulfillment_AI_Scheduling_Log__c> getAISchedulingResult(
        String id
    ) {
        return [
            SELECT Id, Status__c
            FROM Fulfillment_AI_Scheduling_Log__c
            WHERE Id = :id
            LIMIT 1
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
        FOtoUpdate.Status__c = 'Pending';
        update FOtoUpdate;
    }

    @AuraEnabled(cacheable=true)
    public static List<Out_of_Service_Truck_Schedule__c> getOutOfServiceTrucks(
        Date weekStart,
        Date weekEnd
    ) {
        return [
            SELECT Id, Truck__c, Start_Date__c, End_Date__c
            FROM Out_of_Service_Truck_Schedule__c
            WHERE Start_Date__c <= :weekEnd
            AND End_Date__c >= :weekStart
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Holiday_Schedule__c> getHolidays(Date startDate, Date endDate) {
        return [
            SELECT Id, Start_Date__c, End_Date__c, Name, Holiday_Description__c
            FROM Holiday_Schedule__c
            WHERE End_Date__c >= :startDate
            AND Start_Date__c <= :endDate
        ];
    }


}