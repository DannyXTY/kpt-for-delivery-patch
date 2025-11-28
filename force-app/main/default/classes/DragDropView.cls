public with sharing class DragDropView {
    public DragDropView() {

    }

    @AuraEnabled(cacheable=true)
    public static List<Account> getAccounts() {
        return [
            SELECT Id, Name, Industry, Phone
            FROM Account
            ORDER BY Name
            LIMIT 2000
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Fulfillment_Order_Product_Item__c> getPendingFulfillmentOrderProductItems() {
        return [
            SELECT Id, Delivery_Date__c, 
            Name, Quantity__c, Status__c, 
            Total_Weight__c, Unit_Weight__c, Truck__c
            FROM Fulfillment_Order_Product_Item__c
            WHERE Status__c = 'Pending'
            ORDER BY Name
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Fulfillment_Order_Product_Item__c> getAssignedFulfillmentOrderProductItems() {
        return [
            SELECT Id, Delivery_Date__c, 
            Name, Quantity__c, Status__c, 
            Total_Weight__c, Unit_Weight__c, Truck__c
            FROM Fulfillment_Order_Product_Item__c
            WHERE Status__c = 'Assigned'
            ORDER BY Name
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Fulfillment_Order_Product_Item__c> getFulfillmentOrderProductItems() {
        return [
            SELECT Id, Delivery_Date__c, 
            Name, Quantity__c, Status__c, 
            Total_Weight__c, Unit_Weight__c, Truck__c,
            Product__r.Name, Product__r.ProductCode,
            Product__r.Family
            FROM Fulfillment_Order_Product_Item__c
            ORDER BY Name
        ];
    }


    @AuraEnabled(cacheable=true)
    public static List<Truck__c> getTruckList() {
        return [
            SELECT Id, Total_Weight_Allowed__c, Name
            FROM Truck__c
            ORDER By Id
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Fulfillment_Order_Product_Item__c> getFOPI(Date startDate, Date endDate, String accountId) {

        String baseQuery = 
            'SELECT Id, Name, Quantity__c, Total_Weight__c, '
          + 'Status__c, Delivery_Date__c, Truck__c, Truck__r.Name '
          + 'FROM Fulfillment_Order_Product_Item__c '
          + 'WHERE Delivery_Date__c >= :startDate AND Delivery_Date__c <= :endDate';


        baseQuery += ' ORDER BY Delivery_Date__c ASC';

        return Database.query(baseQuery);
    }

   

}