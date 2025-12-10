public with sharing class Integration {

  private class TruckDateInfo {
    private String truckId;
    private String deliveryDate;
    
    private TruckDateInfo(String truckId, String deliveryDate) {
      this.truckId = truckId;
      this.deliveryDate = deliveryDate;
    }
  }

  @AuraEnabled
  public static void upsertDeliveryInfoFOProductItem(String paramsJson) {
        System.debug('params logs from Danny test here');
      System.debug(paramsJson);
      
      List<dtoUpsertDeliveryInfoFOProductItem> params =
    (List<dtoUpsertDeliveryInfoFOProductItem>) JSON.deserialize(
        paramsJson,
        List<dtoUpsertDeliveryInfoFOProductItem>.class
    );

              System.debug('setelah di deseralize');
      System.debug(params);
    
      
      Map<String, TruckDateInfo> productItemToTruckDateMap = new Map<String, TruckDateInfo>();

      for (dtoUpsertDeliveryInfoFOProductItem param : params) {
        for (dtoUpsertDeliveryInfoFOProductItem.clsTruck truck : param.trucks) {
            for (String productItemId : truck.assignedFOProductItem) {
                productItemToTruckDateMap.put(productItemId, new TruckDateInfo(truck.truckId, param.deliveryDate));
            }
        }
      }


      Set<String> productItemIds = productItemToTruckDateMap.keySet();

      List<Fulfillment_Order_Product_Item__c> foProductItems = [
        SELECT
        Id, Name
        FROM Fulfillment_Order_Product_Item__c
        WHERE Id IN :productItemIds
      ];

      for (Fulfillment_Order_Product_Item__c foProductItem : foProductItems) {
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
  
  
  @AuraEnabled
  public static void debugRaw(String paramsJson) {
  
          System.debug('params logs from Danny test here');
      System.debug(paramsJson);
      
      List<dtoUpsertDeliveryInfoFOProductItem> params =
    (List<dtoUpsertDeliveryInfoFOProductItem>) JSON.deserialize(
        paramsJson,
        List<dtoUpsertDeliveryInfoFOProductItem>.class
    );

              System.debug('setelah di deseralize');
      System.debug(params);
    
      
      Map<String, TruckDateInfo> productItemToTruckDateMap = new Map<String, TruckDateInfo>();

      for (dtoUpsertDeliveryInfoFOProductItem param : params) {
        for (dtoUpsertDeliveryInfoFOProductItem.clsTruck truck : param.trucks) {
            for (String productItemId : truck.assignedFOProductItem) {
                productItemToTruckDateMap.put(productItemId, new TruckDateInfo(truck.truckId, param.deliveryDate));
            }
        }
      }


      Set<String> productItemIds = productItemToTruckDateMap.keySet();

      List<Fulfillment_Order_Product_Item__c> foProductItems = [
        SELECT
        Id, Name
        FROM Fulfillment_Order_Product_Item__c
        WHERE Id IN :productItemIds
      ];

      for (Fulfillment_Order_Product_Item__c foProductItem : foProductItems) {
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
     
  
}