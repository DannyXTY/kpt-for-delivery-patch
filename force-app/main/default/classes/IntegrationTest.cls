@isTest
public class IntegrationTest {
    
    @TestSetup
    static void setupTestData() {
        // Create test Fulfillment Order Product Items
        List<Fulfillment_Order_Product_Item__c> foProductItems = new List<Fulfillment_Order_Product_Item__c>();
        
        for (Integer i = 1; i <= 5; i++) {
            foProductItems.add(new Fulfillment_Order_Product_Item__c(
                Name = 'FOPI-' + String.valueOf(i).leftPad(4, '0')
            ));
        }
        
        insert foProductItems;

        List<Truck__c> trucks = new List<Truck__c>();
        for (Integer i = 1; i <= 5; i++) {
            trucks.add(new Truck__c(
                Name = 'TRUCK-' + String.valueOf(i).leftPad(2, '0')
            ));
        }

        insert trucks;
    }
    
    @isTest
    static void testUpsertDeliveryInfoFOProductItem_Success() {
        // Query existing test records
        List<Fulfillment_Order_Product_Item__c> existingItems = [
            SELECT Id, Name, Truck__c, Delivery_Date__c
            FROM Fulfillment_Order_Product_Item__c
        ];
        
        // Verify initial state
        System.assertEquals(5, existingItems.size(), 'Should have 5 test records');
        
        // Prepare test data
        List<dtoUpsertDeliveryInfoFOProductItem> params = new List<dtoUpsertDeliveryInfoFOProductItem>();
        dtoUpsertDeliveryInfoFOProductItem param = new dtoUpsertDeliveryInfoFOProductItem();
        param.date = '2025-01-15';
        
        dtoUpsertDeliveryInfoFOProductItem.clsTruck truck1 = new dtoUpsertDeliveryInfoFOProductItem.clsTruck();
        truck1.truckId = 'TRUCK-001';
        truck1.assignedFOProductItem = new List<String>{'FOPI-0001', 'FOPI-0002'};
        
        dtoUpsertDeliveryInfoFOProductItem.clsTruck truck2 = new dtoUpsertDeliveryInfoFOProductItem.clsTruck();
        truck2.truckId = 'TRUCK-002';
        truck2.assignedFOProductItem = new List<String>{'FOPI-0003'};
        
        param.trucks = new List<dtoUpsertDeliveryInfoFOProductItem.clsTruck>{truck1, truck2};
        params.add(param);
        
        // Execute test
        Test.startTest();
        Integration.upsertDeliveryInfoFOProductItem(params);
        Test.stopTest();
        
        // Verify results
        List<Fulfillment_Order_Product_Item__c> updatedItems = [
            SELECT Id, Name, Truck__c, Delivery_Date__c
            FROM Fulfillment_Order_Product_Item__c
            WHERE Name IN ('FOPI-0001', 'FOPI-0002', 'FOPI-0003')
            ORDER BY Name
        ];
        
        System.assertEquals(3, updatedItems.size(), 'Should have updated 3 items');
        
        // Verify FOPI-0001
        System.assertEquals('TRUCK-001', updatedItems[0].Truck__c, 'FOPI-0001 should be assigned to TRUCK-001');
        System.assertEquals(Date.valueOf('2025-01-15'), updatedItems[0].Delivery_Date__c, 'FOPI-0001 should have correct delivery date');
        
        // Verify FOPI-0002
        System.assertEquals('TRUCK-001', updatedItems[1].Truck__c, 'FOPI-0002 should be assigned to TRUCK-001');
        System.assertEquals(Date.valueOf('2025-01-15'), updatedItems[1].Delivery_Date__c, 'FOPI-0002 should have correct delivery date');
        
        // Verify FOPI-0003
        System.assertEquals('TRUCK-002', updatedItems[2].Truck__c, 'FOPI-0003 should be assigned to TRUCK-002');
        System.assertEquals(Date.valueOf('2025-01-15'), updatedItems[2].Delivery_Date__c, 'FOPI-0003 should have correct delivery date');
    }
    
    @isTest
    static void testUpsertDeliveryInfoFOProductItem_NoMatchingRecords() {
        // Prepare test data with non-existent product items
        List<dtoUpsertDeliveryInfoFOProductItem> params = new List<dtoUpsertDeliveryInfoFOProductItem>();
        dtoUpsertDeliveryInfoFOProductItem param = new dtoUpsertDeliveryInfoFOProductItem();
        param.date = '2025-01-15';
        
        dtoUpsertDeliveryInfoFOProductItem.clsTruck truck = new dtoUpsertDeliveryInfoFOProductItem.clsTruck();
        truck.truckId = 'TRUCK-999';
        truck.assignedFOProductItem = new List<String>{'NON-EXISTENT-001', 'NON-EXISTENT-002'};
        
        param.trucks = new List<dtoUpsertDeliveryInfoFOProductItem.clsTruck>{truck};
        params.add(param);
        
        // Execute test - should not throw exception
        Test.startTest();
        Integration.upsertDeliveryInfoFOProductItem(params);
        Test.stopTest();
        
        // Verify no updates occurred
        List<Fulfillment_Order_Product_Item__c> items = [
            SELECT Id, Truck__c
            FROM Fulfillment_Order_Product_Item__c
            WHERE Truck__c = 'TRUCK-999'
        ];
        
        System.assertEquals(0, items.size(), 'No records should be updated with non-existent product items');
    }
    
    @isTest
    static void testUpsertDeliveryInfoFOProductItem_EmptyParams() {
        // Execute test with empty parameters
        Test.startTest();
        Integration.upsertDeliveryInfoFOProductItem(new List<dtoUpsertDeliveryInfoFOProductItem>());
        Test.stopTest();
        
        // Verify no exceptions thrown and no updates occurred
        List<Fulfillment_Order_Product_Item__c> items = [
            SELECT Id, Truck__c
            FROM Fulfillment_Order_Product_Item__c
            WHERE Truck__c != null
        ];
        
        System.assertEquals(0, items.size(), 'No records should be updated with empty params');
    }
    
    @isTest
    static void testUpsertDeliveryInfoFOProductItem_MultipleParamsWithSameItems() {
        // Test scenario where multiple trucks are assigned to same items (last one wins)
        List<dtoUpsertDeliveryInfoFOProductItem> params = new List<dtoUpsertDeliveryInfoFOProductItem>();
        
        dtoUpsertDeliveryInfoFOProductItem param1 = new dtoUpsertDeliveryInfoFOProductItem();
        param1.date = '2025-01-15';
        dtoUpsertDeliveryInfoFOProductItem.clsTruck truck1 = new dtoUpsertDeliveryInfoFOProductItem.clsTruck();
        truck1.truckId = 'TRUCK-001';
        truck1.assignedFOProductItem = new List<String>{'FOPI-0001'};
        param1.trucks = new List<dtoUpsertDeliveryInfoFOProductItem.clsTruck>{truck1};
        
        dtoUpsertDeliveryInfoFOProductItem param2 = new dtoUpsertDeliveryInfoFOProductItem();
        param2.date = '2025-01-16';
        dtoUpsertDeliveryInfoFOProductItem.clsTruck truck2 = new dtoUpsertDeliveryInfoFOProductItem.clsTruck();
        truck2.truckId = 'TRUCK-002';
        truck2.assignedFOProductItem = new List<String>{'FOPI-0001'};
        param2.trucks = new List<dtoUpsertDeliveryInfoFOProductItem.clsTruck>{truck2};
        
        params.add(param1);
        params.add(param2);
        
        Test.startTest();
        Integration.upsertDeliveryInfoFOProductItem(params);
        Test.stopTest();
        
        // Verify last assignment wins
        Fulfillment_Order_Product_Item__c updatedItem = [
            SELECT Truck__c, Delivery_Date__c
            FROM Fulfillment_Order_Product_Item__c
            WHERE Name = 'FOPI-0001'
            LIMIT 1
        ];
        
        System.assertEquals('TRUCK-002', updatedItem.Truck__c, 'Last truck assignment should win');
        System.assertEquals(Date.valueOf('2025-01-16'), updatedItem.Delivery_Date__c, 'Last date assignment should win');
    }
}