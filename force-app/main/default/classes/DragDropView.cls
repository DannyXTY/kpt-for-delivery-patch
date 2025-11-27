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

    

}