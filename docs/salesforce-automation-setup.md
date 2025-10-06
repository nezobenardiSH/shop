# Salesforce Automation Setup Guide

## Overview

Instead of handling status updates in the portal, we'll set up Salesforce automation to automatically update statuses when certain conditions are met. This is more reliable and follows Salesforce best practices.

## Automation Rules

### 1. Menu Upload → Product Setup Status Update
**Trigger**: When menu is uploaded (via external form or manual update)
**Action**: Update `Product_Setup_Status__c` from "Pending Product List from Merchant" to "Ticket Created - Pending Completion"

### 2. Installation Date → Installation Status Update  
**Trigger**: When `Installation_Date__c` is filled out
**Action**: Update `Hardware_Installation_Status__c` to "Ticket Submitted"

### 3. Training Date → Training Status Update
**Trigger**: When training dates are scheduled
**Action**: Update `Training_Status__c` to "Training Scheduled"

## Implementation Options

### Option 1: Process Builder (Classic - Easy Setup)

#### A. Menu Upload Automation
1. **Setup → Process Builder → New Process**
2. **Object**: Onboarding_Trainer__c
3. **Start Process**: When a record is created or edited

**Criteria Node 1: Menu Upload Detected**
```
Conditions:
- [Onboarding_Trainer__c].Menu_Uploaded__c EQUALS True
  OR
- [Onboarding_Trainer__c].Product_Setup_Status__c EQUALS "Menu Uploaded"
  OR  
- [Onboarding_Trainer__c].Product_List_Received__c EQUALS True

Additional Criteria:
- [Onboarding_Trainer__c].Product_Setup_Status__c EQUALS "Pending Product List from Merchant"
  OR
- [Onboarding_Trainer__c].Product_Setup_Status__c EQUALS "Not Started"
  OR
- [Onboarding_Trainer__c].Product_Setup_Status__c IS NULL
```

**Action:**
- Action Type: Update Records
- Record: [Onboarding_Trainer__c] (the record that started the process)
- Field Updates:
  - `Product_Setup_Status__c` = "Ticket Created - Pending Completion"

#### B. Installation Date Automation
**Criteria Node 2: Installation Date Filled**
```
Conditions:
- [Onboarding_Trainer__c].Installation_Date__c IS NOT NULL
- ISCHANGED([Onboarding_Trainer__c].Installation_Date__c) EQUALS True

Additional Criteria (to avoid overwriting advanced statuses):
- [Onboarding_Trainer__c].Hardware_Installation_Status__c EQUALS "Not Started"
  OR
- [Onboarding_Trainer__c].Hardware_Installation_Status__c IS NULL
```

**Action:**
- Action Type: Update Records  
- Record: [Onboarding_Trainer__c] (the record that started the process)
- Field Updates:
  - `Hardware_Installation_Status__c` = "Ticket Submitted"

### Option 2: Flow (Modern Approach - Recommended)

#### Create Record-Triggered Flow

1. **Setup → Flows → New Flow → Record-Triggered Flow**
2. **Object**: Onboarding_Trainer__c
3. **Trigger**: When a record is updated
4. **Entry Conditions**: Run the flow when... (configure conditions below)

#### Flow Logic

**Decision Element 1: Check Menu Upload**
```
Outcome 1: Menu Uploaded
Conditions:
- {!$Record.Menu_Uploaded__c} Equals {!$GlobalConstant.True}
  OR
- {!$Record.Product_Setup_Status__c} Equals "Menu Uploaded" 
  OR
- {!$Record.Product_List_Received__c} Equals {!$GlobalConstant.True}

AND (Additional Safety Check):
- {!$Record.Product_Setup_Status__c} Equals "Pending Product List from Merchant"
  OR  
- {!$Record.Product_Setup_Status__c} Equals "Not Started"
  OR
- ISBLANK({!$Record.Product_Setup_Status__c})
```

**Update Records Element 1:**
- Object: Onboarding_Trainer__c
- Record ID: {!$Record.Id}
- Field Values:
  - Product_Setup_Status__c = "Ticket Created - Pending Completion"

**Decision Element 2: Check Installation Date**
```
Outcome 2: Installation Date Set
Conditions:
- NOT(ISBLANK({!$Record.Installation_Date__c}))
- {!$Record.Installation_Date__c} != {!$Record__Prior.Installation_Date__c}

AND (Safety Check):
- {!$Record.Hardware_Installation_Status__c} Equals "Not Started"
  OR
- ISBLANK({!$Record.Hardware_Installation_Status__c})
```

**Update Records Element 2:**
- Object: Onboarding_Trainer__c  
- Record ID: {!$Record.Id}
- Field Values:
  - Hardware_Installation_Status__c = "Ticket Submitted"

**Decision Element 3: Check Training Dates**
```
Outcome 3: Training Scheduled
Conditions:
- NOT(ISBLANK({!$Record.BackOffice_Training_Date__c}))
  OR
- NOT(ISBLANK({!$Record.POS_Training_Date__c}))

AND (Safety Check):
- {!$Record.Training_Status__c} Equals "Not Started"
  OR
- ISBLANK({!$Record.Training_Status__c})
```

**Update Records Element 3:**
- Object: Onboarding_Trainer__c
- Record ID: {!$Record.Id}  
- Field Values:
  - Training_Status__c = "Training Scheduled"

### Option 3: Apex Trigger (Advanced - Most Flexible)

#### Create Apex Trigger

```apex
trigger OnboardingTrainerAutomation on Onboarding_Trainer__c (before update) {
    OnboardingTrainerAutomationHandler.handleUpdate(Trigger.new, Trigger.oldMap);
}
```

#### Create Apex Handler Class

```apex
public class OnboardingTrainerAutomationHandler {
    
    public static void handleUpdate(List<Onboarding_Trainer__c> newRecords, Map<Id, Onboarding_Trainer__c> oldMap) {
        
        for (Onboarding_Trainer__c trainer : newRecords) {
            Onboarding_Trainer__c oldTrainer = oldMap.get(trainer.Id);
            
            // 1. Menu Upload Automation
            handleMenuUploadStatusUpdate(trainer, oldTrainer);
            
            // 2. Installation Date Automation  
            handleInstallationDateUpdate(trainer, oldTrainer);
            
            // 3. Training Date Automation
            handleTrainingDateUpdate(trainer, oldTrainer);
        }
    }
    
    private static void handleMenuUploadStatusUpdate(Onboarding_Trainer__c trainer, Onboarding_Trainer__c oldTrainer) {
        // Check if menu upload indicators changed
        Boolean menuUploadDetected = 
            (trainer.Menu_Uploaded__c == true && oldTrainer.Menu_Uploaded__c != true) ||
            (trainer.Product_List_Received__c == true && oldTrainer.Product_List_Received__c != true) ||
            (trainer.Product_Setup_Status__c == 'Menu Uploaded' && oldTrainer.Product_Setup_Status__c != 'Menu Uploaded');
        
        // Check if status should be updated
        Set<String> statusesToUpdate = new Set<String>{
            'Pending Product List from Merchant',
            'Not Started',
            null
        };
        
        if (menuUploadDetected && statusesToUpdate.contains(trainer.Product_Setup_Status__c)) {
            trainer.Product_Setup_Status__c = 'Ticket Created - Pending Completion';
            System.debug('Updated Product Setup Status due to menu upload: ' + trainer.Id);
        }
    }
    
    private static void handleInstallationDateUpdate(Onboarding_Trainer__c trainer, Onboarding_Trainer__c oldTrainer) {
        // Check if installation date was just set
        Boolean installationDateSet = 
            trainer.Installation_Date__c != null && 
            oldTrainer.Installation_Date__c != trainer.Installation_Date__c;
        
        // Check if status should be updated
        Set<String> statusesToUpdate = new Set<String>{
            'Not Started',
            null
        };
        
        if (installationDateSet && statusesToUpdate.contains(trainer.Hardware_Installation_Status__c)) {
            trainer.Hardware_Installation_Status__c = 'Ticket Submitted';
            System.debug('Updated Installation Status due to date scheduling: ' + trainer.Id);
        }
    }
    
    private static void handleTrainingDateUpdate(Onboarding_Trainer__c trainer, Onboarding_Trainer__c oldTrainer) {
        // Check if any training date was set
        Boolean trainingDateSet = 
            (trainer.BackOffice_Training_Date__c != null && oldTrainer.BackOffice_Training_Date__c != trainer.BackOffice_Training_Date__c) ||
            (trainer.POS_Training_Date__c != null && oldTrainer.POS_Training_Date__c != trainer.POS_Training_Date__c);
        
        // Check if status should be updated
        Set<String> statusesToUpdate = new Set<String>{
            'Not Started',
            null
        };
        
        if (trainingDateSet && statusesToUpdate.contains(trainer.Training_Status__c)) {
            trainer.Training_Status__c = 'Training Scheduled';
            System.debug('Updated Training Status due to date scheduling: ' + trainer.Id);
        }
    }
}
```

#### Create Test Class

```apex
@isTest
public class OnboardingTrainerAutomationHandlerTest {
    
    @isTest
    static void testMenuUploadStatusUpdate() {
        // Create test data
        Onboarding_Trainer__c trainer = new Onboarding_Trainer__c(
            Name = 'Test Trainer',
            Product_Setup_Status__c = 'Pending Product List from Merchant'
        );
        insert trainer;
        
        // Test menu upload
        trainer.Menu_Uploaded__c = true;
        update trainer;
        
        // Verify status updated
        trainer = [SELECT Product_Setup_Status__c FROM Onboarding_Trainer__c WHERE Id = :trainer.Id];
        System.assertEquals('Ticket Created - Pending Completion', trainer.Product_Setup_Status__c);
    }
    
    @isTest
    static void testInstallationDateUpdate() {
        // Create test data
        Onboarding_Trainer__c trainer = new Onboarding_Trainer__c(
            Name = 'Test Trainer',
            Hardware_Installation_Status__c = 'Not Started'
        );
        insert trainer;
        
        // Test installation date setting
        trainer.Installation_Date__c = Date.today().addDays(7);
        update trainer;
        
        // Verify status updated
        trainer = [SELECT Hardware_Installation_Status__c FROM Onboarding_Trainer__c WHERE Id = :trainer.Id];
        System.assertEquals('Ticket Submitted', trainer.Hardware_Installation_Status__c);
    }
    
    @isTest
    static void testTrainingDateUpdate() {
        // Create test data
        Onboarding_Trainer__c trainer = new Onboarding_Trainer__c(
            Name = 'Test Trainer',
            Training_Status__c = 'Not Started'
        );
        insert trainer;
        
        // Test training date setting
        trainer.BackOffice_Training_Date__c = Date.today().addDays(10);
        update trainer;
        
        // Verify status updated
        trainer = [SELECT Training_Status__c FROM Onboarding_Trainer__c WHERE Id = :trainer.Id];
        System.assertEquals('Training Scheduled', trainer.Training_Status__c);
    }
}
```

## Recommended Implementation Steps

### Phase 1: Start with Flow (Easiest)
1. Create Record-Triggered Flow for Onboarding_Trainer__c
2. Implement Decision Elements for each automation rule
3. Test in Sandbox first
4. Deploy to Production

### Phase 2: Add Field Validations (Optional)
Create validation rules to ensure data integrity:

```
Rule: Prevent Installation Status Regression
Formula: 
AND(
  ISCHANGED(Hardware_Installation_Status__c),
  ISPICKVAL(PRIORVALUE(Hardware_Installation_Status__c), "Completed"),
  NOT(ISPICKVAL(Hardware_Installation_Status__c, "Completed"))
)

Error Message: "Cannot change status from Completed to a previous stage"
```

### Phase 3: Add Notifications (Optional)
- Create email alerts when statuses change
- Use Process Builder to send notifications to relevant teams
- Update external systems via HTTP callouts if needed

## Benefits of Salesforce-Native Automation

✅ **Reliability**: Runs regardless of portal availability  
✅ **Data Integrity**: Single source of truth in Salesforce  
✅ **Auditability**: Full audit trail of changes  
✅ **Performance**: No external API calls needed  
✅ **Governance**: Follows Salesforce security and permissions  
✅ **Scalability**: Handles bulk operations efficiently  

## Monitoring and Maintenance

1. **Debug Logs**: Monitor automation execution in Setup → Debug Logs
2. **Process Builder History**: Check execution history in Process Builder
3. **Flow Interview Logs**: Review flow executions in Setup → Flow
4. **Field History Tracking**: Enable field history on key status fields

This approach ensures your status updates happen reliably within Salesforce's native automation framework!