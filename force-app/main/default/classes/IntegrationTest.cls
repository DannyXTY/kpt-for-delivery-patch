@isTest
public class IntegrationTest {
    
    @TestSetup
    static void setupTestData() {
        // Create test Account (if needed for Order)
        Account testAccount = new Account(
            Name = 'Test Account'
        );
        insert testAccount;
        
        // Create test Order
        Order testOrder = new Order(
            AccountId = testAccount.Id,
            Status = 'Draft',
            EffectiveDate = Date.today()
        );
        insert testOrder;
        
        // Create test Fulfillment Orders
        List<FulfillmentOrder__c> fulfillmentOrders = new List<FulfillmentOrder__c>();
        for (Integer i = 1; i <= 2; i++) {
            fulfillmentOrders.add(new FulfillmentOrder__c(
                Order__c = testOrder.Id
                // Add other required fields if needed
            ));
        }
        insert fulfillmentOrders;
        
        // Create test Fulfillment Order Product Items
        List<Fulfillment_Order_Product_Item__c> foProductItems = new List<Fulfillment_Order_Product_Item__c>();
        
        for (Integer i = 0; i < 5; i++) {
            foProductItems.add(new Fulfillment_Order_Product_Item__c(
                Fulfillment__c = fulfillmentOrders[Math.mod(i, 2)].Id
                // Add other required fields if needed
            ));
        }
        
        insert foProductItems;

        // Create test Trucks
        List<Truck__c> trucks = new List<Truck__c>();
        for (Integer i = 1; i <= 5; i++) {
            trucks.add(new Truck__c(
                // Add required fields if needed
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
            LIMIT 3
        ];
        
        List<Truck__c> existingTrucks = [
            SELECT Id, Name
            FROM Truck__c
            LIMIT 2
        ];
        
        // Verify initial state
        System.assert(existingItems.size() >= 3, 'Should have at least 3 test records');
        System.assert(existingTrucks.size() >= 2, 'Should have at least 2 test trucks');
        
        // Prepare test data using actual record Names and Truck Ids
        List<dtoUpsertDeliveryInfoFOProductItem> params = new List<dtoUpsertDeliveryInfoFOProductItem>();
        dtoUpsertDeliveryInfoFOProductItem param = new dtoUpsertDeliveryInfoFOProductItem();
        param.deliveryDate = '2025-01-15';
        
        dtoUpsertDeliveryInfoFOProductItem.clsTruck truck1 = new dtoUpsertDeliveryInfoFOProductItem.clsTruck();
        truck1.truckId = existingTrucks[0].Id;
        truck1.assignedFOProductItem = new List<String>{existingItems[0].Name, existingItems[1].Name};
        
        dtoUpsertDeliveryInfoFOProductItem.clsTruck truck2 = new dtoUpsertDeliveryInfoFOProductItem.clsTruck();
        truck2.truckId = existingTrucks[1].Id;
        truck2.assignedFOProductItem = new List<String>{existingItems[2].Name};
        
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
            WHERE Id IN :new List<Id>{existingItems[0].Id, existingItems[1].Id, existingItems[2].Id}
            ORDER BY Name
        ];
        
        System.assertEquals(3, updatedItems.size(), 'Should have updated 3 items');
        
        // Verify items have truck assignments
        System.assertEquals(existingTrucks[0].Id, updatedItems[0].Truck__c, 'First item should be assigned to truck 1');
        System.assertEquals(Date.valueOf('2025-01-15'), updatedItems[0].Delivery_Date__c, 'First item should have correct delivery date');
        
        System.assertEquals(existingTrucks[0].Id, updatedItems[1].Truck__c, 'Second item should be assigned to truck 1');
        System.assertEquals(Date.valueOf('2025-01-15'), updatedItems[1].Delivery_Date__c, 'Second item should have correct delivery date');
        
        System.assertEquals(existingTrucks[1].Id, updatedItems[2].Truck__c, 'Third item should be assigned to truck 2');
        System.assertEquals(Date.valueOf('2025-01-15'), updatedItems[2].Delivery_Date__c, 'Third item should have correct delivery date');
    }
    
    @isTest
    static void testUpsertDeliveryInfoFOProductItem_NoMatchingRecords() {
        // Prepare test data with non-existent product items
        List<dtoUpsertDeliveryInfoFOProductItem> params = new List<dtoUpsertDeliveryInfoFOProductItem>();
        dtoUpsertDeliveryInfoFOProductItem param = new dtoUpsertDeliveryInfoFOProductItem();
        param.deliveryDate = '2025-01-15';
        
        dtoUpsertDeliveryInfoFOProductItem.clsTruck truck = new dtoUpsertDeliveryInfoFOProductItem.clsTruck();
        truck.truckId = 'a015g00000Axxxx'; // Use valid 18-char Salesforce ID format
        truck.assignedFOProductItem = new List<String>{'NON-EXISTENT-001', 'NON-EXISTENT-002'};
        
        param.trucks = new List<dtoUpsertDeliveryInfoFOProductItem.clsTruck>{truck};
        params.add(param);
        
        // Execute test - should not throw exception
        Test.startTest();
        Integration.upsertDeliveryInfoFOProductItem(params);
        Test.stopTest();
        
        // Verify no updates occurred with the fake truck ID
        List<Fulfillment_Order_Product_Item__c> items = [
            SELECT Id, Truck__c
            FROM Fulfillment_Order_Product_Item__c
            WHERE Truck__c = 'a015g00000Axxxx'
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
        // Query existing test records
        List<Fulfillment_Order_Product_Item__c> existingItems = [
            SELECT Id, Name
            FROM Fulfillment_Order_Product_Item__c
            LIMIT 1
        ];
        
        List<Truck__c> existingTrucks = [
            SELECT Id
            FROM Truck__c
            LIMIT 2
        ];
        
        System.assert(existingItems.size() > 0, 'Should have at least 1 test record');
        System.assert(existingTrucks.size() >= 2, 'Should have at least 2 test trucks');
        
        // Test scenario where multiple trucks are assigned to same items (last one wins)
        List<dtoUpsertDeliveryInfoFOProductItem> params = new List<dtoUpsertDeliveryInfoFOProductItem>();
        
        dtoUpsertDeliveryInfoFOProductItem param1 = new dtoUpsertDeliveryInfoFOProductItem();
        param1.deliveryDate = '2025-01-15';
        dtoUpsertDeliveryInfoFOProductItem.clsTruck truck1 = new dtoUpsertDeliveryInfoFOProductItem.clsTruck();
        truck1.truckId = existingTrucks[0].Id;
        truck1.assignedFOProductItem = new List<String>{existingItems[0].Name};
        param1.trucks = new List<dtoUpsertDeliveryInfoFOProductItem.clsTruck>{truck1};
        
        dtoUpsertDeliveryInfoFOProductItem param2 = new dtoUpsertDeliveryInfoFOProductItem();
        param2.deliveryDate = '2025-01-16';
        dtoUpsertDeliveryInfoFOProductItem.clsTruck truck2 = new dtoUpsertDeliveryInfoFOProductItem.clsTruck();
        truck2.truckId = existingTrucks[1].Id;
        truck2.assignedFOProductItem = new List<String>{existingItems[0].Name};
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
            WHERE Id = :existingItems[0].Id
            LIMIT 1
        ];
        
        System.assertEquals(existingTrucks[1].Id, updatedItem.Truck__c, 'Last truck assignment should win');
        System.assertEquals(Date.valueOf('2025-01-16'), updatedItem.Delivery_Date__c, 'Last date assignment should win');
    }
}