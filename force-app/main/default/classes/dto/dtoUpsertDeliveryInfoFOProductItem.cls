public class dtoUpsertDeliveryInfoFOProductItem {
    public String dayName;
    public String date;
    public List<clsTruck> trucks;
    
    public class clsTruck {
      public String truckId;
      public Decimal capacity;
      public List<String> assignedFOProductItem;
    }
}