# Trainer Assignment Rules

## Overview

This document defines the rules for assigning trainers to merchants based on service type, location, and language requirements.

## Training Types

### 1. POS Training (`pos-training`)
Training on Point of Sale system usage and features.

### 2. Back Office Training (`backoffice-training`)
Training on back office management, reporting, and administrative features.

## Service Type Classification

The system determines trainer assignment based on the **Onboarding Services Bought** field from Salesforce (`Onboarding_Services_Bought__c`).

### Onsite Training
**Service Types:**
- `Onsite training`
- `Onsite Training`
- Any variation containing "onsite"

**Filtering Criteria:**
1. ✅ **Language Match** - Trainer must speak selected language(s)
2. ✅ **Location Match** - Trainer must cover merchant's geographical area
3. ✅ **Calendar Availability** - Trainer must be free at selected time

**Example:**
```
Merchant: Nasi Lemak Restaurant
Location: Kuala Lumpur
Language: Bahasa Malaysia
Service: Onsite training

→ Filters to: Nezo (covers KL, speaks Bahasa Malaysia)
```

### Remote Training
**Service Types:**
- `Remote Full Service`
- `Online Training`
- `Remote training`
- Any variation containing "remote" or "online"

**Filtering Criteria:**
1. ✅ **Language Match** - Trainer must speak selected language(s)
2. ❌ **Location Match** - NOT required (training is remote)
3. ✅ **Calendar Availability** - Trainer must be free at selected time

**Example:**
```
Merchant: Nasi Lemak Restaurant
Location: Kuala Lumpur
Language: Bahasa Malaysia
Service: Remote Full Service

→ Filters to: All trainers who speak Bahasa Malaysia
→ Result: Nezo, Jia En, Izzudin (all speak Bahasa Malaysia)
```

### No Service Type / Unknown
**Behavior:**
- Schedule button is **disabled**
- User cannot book training
- System displays message: "Please contact support to set up onboarding service"

## Implementation Logic

### Service Type Detection

```typescript
function getServiceType(onboardingServicesBought: string | null): 'onsite' | 'remote' | 'none' {
  if (!onboardingServicesBought) return 'none'
  
  const service = onboardingServicesBought.toLowerCase()
  
  // Check for onsite training
  if (service.includes('onsite')) {
    return 'onsite'
  }
  
  // Check for remote/online training
  if (service.includes('remote') || service.includes('online')) {
    return 'remote'
  }
  
  // Unknown service type
  return 'none'
}
```

### Trainer Filtering Flow

```
1. Check Onboarding Services Bought
   ↓
2. Determine Service Type (onsite/remote/none)
   ↓
3. If 'none' → Disable Schedule button
   ↓
4. If 'onsite' → Filter by Language AND Location
   ↓
5. If 'remote' → Filter by Language ONLY
   ↓
6. Check Calendar Availability
   ↓
7. Show Available Slots
```

## UI Behavior

### Schedule Button States

#### Enabled (Green)
```
Conditions:
- Onboarding Services Bought is set
- Service type is recognized (onsite or remote)
- At least one trainer matches criteria

Display: "Schedule POS Training" or "Schedule Back Office Training"
```

#### Disabled (Gray)
```
Conditions:
- Onboarding Services Bought is null/empty
- Service type is not recognized
- No trainers match criteria

Display: "Schedule Training (Contact Support)"
Tooltip: "Please contact support to set up onboarding service"
```

### Language Filter Display

#### Onsite Training
```
Show: Language selection checkboxes (only available languages enabled)
Note: "Onsite training - filtered by language and location"
Info: "Available languages: English, Bahasa Malaysia" (example for KL)
```

#### Remote Training
```
Show: Language selection checkboxes (only available languages enabled)
Note: "Remote training - all trainers available (filtered by language only)"
Info: "Available languages: English, Bahasa Malaysia, Chinese" (all trainers)
```

#### Dynamic Language Options
- ✅ **Enabled**: Languages spoken by available trainers (clickable, normal color)
- ❌ **Disabled**: Languages not spoken by any available trainer (grayed out, not clickable)
- **Tooltip**: "No trainers available for this language" (on disabled options)

## Examples

### Example 1: Onsite Training in Kuala Lumpur

**Merchant Data:**
- Name: Nasi Lemak Restaurant
- Address: "123 Jalan Ampang, Kuala Lumpur"
- Onboarding Services Bought: "Onsite training"
- Preferred Language: Bahasa Malaysia

**Filtering Process:**
1. Service Type: `onsite` (contains "onsite")
2. Extract Location: "Kuala Lumpur"
3. Filter by Location: Nezo (covers KL + Selangor)
4. Filter by Language: Nezo (speaks Bahasa Malaysia)
5. Check Availability: Show Nezo's available slots

**Result:** Only Nezo's availability shown

---

### Example 2: Remote Training in Penang

**Merchant Data:**
- Name: Char Kuey Teow Stall
- Address: "456 Lebuh Chulia, Georgetown, Penang"
- Onboarding Services Bought: "Remote Full Service"
- Preferred Language: Chinese

**Filtering Process:**
1. Service Type: `remote` (contains "remote")
2. Location: Ignored (remote training)
3. Filter by Language: Jia En (speaks Chinese)
4. Check Availability: Show Jia En's available slots

**Result:** Jia En's availability shown (location doesn't matter for remote)

---

### Example 3: No Service Type

**Merchant Data:**
- Name: Roti Canai Shop
- Address: "789 Jalan Raja, Johor Bahru"
- Onboarding Services Bought: null
- Preferred Language: English

**Filtering Process:**
1. Service Type: `none` (no service bought)
2. Schedule button: DISABLED
3. Message: "Please contact support to set up onboarding service"

**Result:** Cannot schedule training

---

### Example 4: Onsite Training in Johor

**Merchant Data:**
- Name: Laksa House
- Address: "321 Jalan Tun Razak, Johor Bahru, Johor"
- Onboarding Services Bought: "Onsite training"
- Preferred Language: Bahasa Malaysia

**Filtering Process:**
1. Service Type: `onsite` (contains "onsite")
2. Extract Location: "Johor"
3. Filter by Location: Izzudin (covers Johor)
4. Filter by Language: Izzudin (speaks Bahasa Malaysia)
5. Check Availability: Show Izzudin's available slots

**Result:** Only Izzudin's availability shown

## Intelligent Trainer Assignment Strategy

### Priority-Based Assignment Logic

When multiple trainers are available for a time slot, the system uses an intelligent assignment strategy to maximize scheduling flexibility:

**Core Principle:**
> Prioritize trainers with limited language capabilities first, reserving multilingual trainers for sessions requiring their specialized language skills.

**Assignment Algorithm:**

1. **Language Filtering**
   - Filter available trainers to only those who speak ALL required languages
   - If no trainers match all languages, fallback to trainers who speak at least one required language

2. **Specialist Prioritization**
   - Sort qualified trainers by language count (ascending)
   - Prioritize trainers with fewer language capabilities
   - Reserve multilingual trainers for sessions where their additional skills are needed

3. **Load Distribution**
   - If multiple specialists have the same language count, randomly select among them
   - This distributes workload evenly among trainers with similar capabilities

### Example Scenarios

#### Scenario 1: English Training in Klang Valley

**Available Trainers:**
- John Lai: English only (1 language)
- Vwie: English, Malay, Chinese (3 languages)

**Assignment:**
- ✅ **Assign: John Lai** (specialist with 1 language)
- 🔒 **Reserve: Vwie** for Malay or Chinese sessions where John cannot serve

**Rationale:** Maximize scheduling flexibility by keeping the multilingual trainer available for requests requiring Malay or Chinese.

---

#### Scenario 2: Bahasa Malaysia Training

**Available Trainers:**
- Nezo: English, Bahasa Malaysia (2 languages)
- Jia En: Bahasa Malaysia, Chinese (2 languages)
- Izzudin: Bahasa Malaysia (1 language)

**Assignment:**
- ✅ **Assign: Izzudin** (specialist with 1 language)
- 🔒 **Reserve: Nezo & Jia En** for English/Chinese sessions

**Rationale:** Izzudin is the specialist for Bahasa Malaysia only. Reserve Nezo for English sessions and Jia En for Chinese sessions.

---

#### Scenario 3: Multiple Specialists Available

**Available Trainers:**
- John Lai: English only (1 language)
- Sarah: English only (1 language)
- Vwie: English, Malay, Chinese (3 languages)

**Assignment:**
- ✅ **Randomly select: John Lai OR Sarah** (both specialists with 1 language)
- 🔒 **Reserve: Vwie** for multilingual sessions

**Rationale:** Both John and Sarah are equally specialized. Random selection distributes workload evenly between them.

---

#### Scenario 4: Multilingual Requirement

**Required Languages:** English + Chinese

**Available Trainers:**
- John Lai: English only (1 language) ❌ Cannot serve
- Vwie: English, Malay, Chinese (3 languages) ✅ Can serve
- Sarah: English, Chinese (2 languages) ✅ Can serve

**Assignment:**
- ✅ **Assign: Sarah** (specialist with 2 languages)
- 🔒 **Reserve: Vwie** for sessions requiring Malay

**Rationale:** Sarah is the specialist for English+Chinese. Reserve Vwie for sessions requiring all three languages.

### Benefits of This Strategy

1. **Maximizes Scheduling Flexibility**
   - Keeps versatile resources available for complex requests
   - Reduces scheduling conflicts for specialized language requirements

2. **Optimizes Resource Utilization**
   - Deploys specialists strategically
   - Prevents over-reliance on multilingual trainers

3. **Improves Service Coverage**
   - Ensures rare language combinations can be served
   - Balances workload across the trainer team

4. **Fair Load Distribution**
   - Random selection among equal specialists prevents favoritism
   - Distributes bookings evenly across trainers with similar capabilities

## Trainer Coverage Matrix

| Trainer | Languages | Locations | Language Count | Assignment Priority |
|---------|-----------|-----------|----------------|---------------------|
| **Izzudin** | Bahasa Malaysia | Johor | 1 | 🥇 Highest (for Bahasa Malaysia) |
| **Nezo** | English, Bahasa Malaysia | Kuala Lumpur, Selangor | 2 | 🥈 Medium |
| **Jia En** | Bahasa Malaysia, Chinese | Penang | 2 | 🥈 Medium |

**Assignment Examples:**
- **English only** → Nezo (only option)
- **Bahasa Malaysia only** → Izzudin (specialist, 1 language)
- **Chinese only** → Jia En (only option)
- **English + Bahasa Malaysia** → Nezo (only option)
- **Bahasa Malaysia + Chinese** → Jia En (only option)

## API Response Format

### Availability with Service Type

```json
{
  "date": "2025-11-07",
  "slots": [
    {
      "start": "10:00",
      "end": "11:00",
      "available": true,
      "availableTrainers": ["Nezo"],
      "availableLanguages": ["English", "Bahasa Malaysia"],
      "availableLocations": ["Kuala Lumpur", "Selangor"],
      "serviceType": "onsite"
    }
  ]
}
```

## Error Handling

### No Trainers Available

**Scenario:** Merchant in location with no trainer coverage

**Example:**
- Location: Sabah
- Service: Onsite training
- No trainer covers Sabah

**Behavior:**
- Show message: "No trainers available for onsite training in your area"
- Suggest: "Please contact support for remote training options"

### Invalid Service Type

**Scenario:** Onboarding Services Bought contains unrecognized value

**Example:**
- Onboarding Services Bought: "Custom Package"

**Behavior:**
- Disable Schedule button
- Show message: "Please contact support to configure training service"

## Testing Checklist

### Onsite Training Tests
- [ ] KL merchant with onsite → Shows only Nezo
- [ ] Selangor merchant with onsite → Shows only Nezo
- [ ] Penang merchant with onsite → Shows only Jia En
- [ ] Johor merchant with onsite → Shows only Izzudin
- [ ] Sabah merchant with onsite → Shows "no trainers available"

### Remote Training Tests
- [ ] Any location with remote → Shows all trainers (filtered by language)
- [ ] KL merchant with remote + English → Shows Nezo
- [ ] Penang merchant with remote + Chinese → Shows Jia En
- [ ] Any merchant with remote + Bahasa Malaysia → Shows all trainers

### No Service Type Tests
- [ ] Null service → Schedule button disabled
- [ ] Empty service → Schedule button disabled
- [ ] Unknown service → Schedule button disabled

## Related Documentation

- [Location-Based Trainer Assignment](./LOCATION-BASED-TRAINER-ASSIGNMENT.md)
- [Trainer Information](./trainer-information.md)
- [Training Calendar System](./training-calendar.md)

---

*Last Updated: 2025-10-15*  
*Document Owner: Development Team*

