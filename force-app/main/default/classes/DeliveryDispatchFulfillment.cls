public with sharing class DeliveryDispatchFulfillment {
    @AuraEnabled(cacheable=true)
    public static List<FulfillmentOrder__c> getFulfillmentOrders() {
        return [
            SELECT Id, Delivery_Date__c, 
            Name, No_of_Product_Items__c, Status__c, 
            Order__c, Total_Weight__c, Truck__c,
            Customer_No__c, CurrencyIsoCode,
            Order__r.Account.Name,
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

    public static void updateFOProductItemToPending(String FOPIName) {
    if (String.isBlank(FOPIName)) {
      return;
    }

    Fulfillment_Order_Product_Item__c FOPItoUpdate = [
      SELECT Id, Name, Status__c FROM Fulfillment_Order_Product_Item__c WHERE Name = :FOPIName LIMIT 1
    ];

    if (FOPIName == null) {
      return;
    }

    FOPItoUpdate.Truck__c = null;
    FOPItoUpdate.Delivery_Date__c = null;
    FOPItoUpdate.Status__c = 'Pending';
    update FOPItoUpdate;
  } 

}