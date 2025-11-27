public with sharing class Integration {

  private class TruckDateInfo {
    private String truckId;
    private String date;
    
    private TruckDateInfo(String truckId, String date) {
      this.truckId = truckId;
      this.date = date;
    }
  }

  public static void upsertDeliveryInfoFOProductItem(List<dtoUpsertDeliveryInfoFOProductItem> params) {
      Map<String, TruckDateInfo> productItemToTruckDateMap = new Map<String, TruckDateInfo>();

      for (dtoUpsertDeliveryInfoFOProductItem param : params) {
        for (dtoUpsertDeliveryInfoFOProductItem.clsTruck truck : param.trucks) {
            for (String productItemId : truck.assignedFOProductItem) {
                productItemToTruckDateMap.put(productItemId, new TruckDateInfo(truck.truckId, param.date));
            }
        }
      }

      List<String> productItemNames = productItemToTruckDateMap.keySet();

      List<Fulfillment_Order_Product_Item__c> foProductItems = [
        SELECT
        Id, Name
        FROM Fulfillment_Order_Product_Item__c
        WHERE Name in :productItemNames
      ];

      for (Fulfillment_Order_Product_Item__c foProductItem : foProductItems) {
        TruckDateInfo truckDateInfo = productItemToTruckDateMap.get(foProductItem.Name);
        
        if (truckDateInfo == null) {
            continue;
        }

        foProductItem.Truck__c = truckDateInfo.truckId;
        foProductItem.Delivery_Date__c = Date.valueOf(truckDateInfo.date);
      }

      if (!foProductItems.isEmpty()) {
        update foProductItems;
      }
  }
}