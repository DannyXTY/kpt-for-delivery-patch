public with sharing class dtoUpsertDeliveryInfoFO {
    public String dayName;
    public String deliveryDate;
    public List<clsTruck> trucks;

    public class clsTruck {
      public String truckId;
      public Decimal capacity;
      public List<String> assignedFO;
    }
}