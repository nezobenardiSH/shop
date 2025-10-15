# Location-Based Trainer Assignment

## Overview

The system now supports location-based trainer assignment to ensure merchants are matched with trainers who cover their geographical area. This is in addition to the existing language-based filtering.

## Trainer Locations

### Current Configuration

**File**: `config/trainers.json`

```json
{
  "trainers": [
    {
      "name": "Nezo",
      "location": ["Kuala Lumpur", "Selangor"]
    },
    {
      "name": "Jia En",
      "location": ["Penang"]
    },
    {
      "name": "Izzudin",
      "location": ["Johor"]
    }
  ]
}
```

### Location Coverage

| Trainer | Locations Covered |
|---------|------------------|
| **Nezo** | Kuala Lumpur, Selangor |
| **Jia En** | Penang |
| **Izzudin** | Johor |

## How It Works

### 1. Location Extraction

The system extracts the state/location from the merchant's address using pattern matching.

**Supported States** (with variations):
- **Kuala Lumpur**: kuala lumpur, kl, k.l, wilayah persekutuan kuala lumpur
- **Selangor**: selangor, sel, selangor darul ehsan
- **Penang**: penang, pulau pinang, p. pinang, pg, pn
- **Johor**: johor, johor bahru, jb, j.b, johor darul takzim
- **Perak**: perak, ipoh
- **Kedah**: kedah, alor setar
- **Kelantan**: kelantan, kota bharu
- **Terengganu**: terengganu, kuala terengganu
- **Pahang**: pahang, kuantan
- **Negeri Sembilan**: negeri sembilan, n. sembilan, ns, seremban
- **Melaka**: melaka, malacca
- **Sabah**: sabah, kota kinabalu
- **Sarawak**: sarawak, kuching
- **Perlis**: perlis, kangar
- **Putrajaya**: putrajaya
- **Labuan**: labuan

### 2. Location Matching

**Matching Logic**:
```typescript
// Extract location from merchant address
const merchantLocations = extractLocationFromAddress(merchantAddress)
// Example: "123 Jalan Ampang, Kuala Lumpur" → ["Kuala Lumpur"]

// Check if trainer covers this location
const isMatch = trainerLocations.some(trainerLoc =>
  merchantLocations.includes(trainerLoc)
)
```

**Examples**:

| Merchant Address | Extracted Location | Matched Trainer |
|-----------------|-------------------|-----------------|
| "123 Jalan Ampang, Kuala Lumpur" | Kuala Lumpur | Nezo |
| "456 Jalan Sultan, Petaling Jaya, Selangor" | Selangor | Nezo |
| "789 Lebuh Chulia, Georgetown, Penang" | Penang | Jia En |
| "321 Jalan Tun Razak, Johor Bahru, Johor" | Johor | Izzudin |

### 3. Availability Filtering

When fetching available time slots, the system now includes location information:

```typescript
interface TimeSlot {
  start: string
  end: string
  available: boolean
  availableTrainers?: string[]
  availableLanguages?: string[]
  availableLocations?: string[]  // NEW
}
```

**Example Response**:
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
      "availableLocations": ["Kuala Lumpur", "Selangor"]
    }
  ]
}
```

## Implementation Details

### Files Modified

1. **`config/trainers.json`**
   - Added `location` field to each trainer
   - Location is an array to support trainers covering multiple states

2. **`lib/trainer-availability.ts`**
   - Updated `TimeSlot` interface to include `availableLocations`
   - Modified availability calculation to track locations
   - Added location aggregation logic

3. **`lib/location-matcher.ts`** ⭐ **NEW**
   - Location extraction from address
   - Location matching logic
   - Trainer filtering by location
   - Malaysian state variations mapping

### Key Functions

#### `extractLocationFromAddress(address: string): string[]`
Extracts state names from address string.

```typescript
extractLocationFromAddress("123 Jalan Ampang, Kuala Lumpur")
// Returns: ["Kuala Lumpur"]

extractLocationFromAddress("456 Jalan Sultan, Petaling Jaya, Selangor")
// Returns: ["Selangor"]
```

#### `isLocationMatch(trainerLocations: string[], merchantAddress: string): boolean`
Checks if trainer location matches merchant location.

```typescript
isLocationMatch(["Kuala Lumpur", "Selangor"], "123 Jalan Ampang, KL")
// Returns: true

isLocationMatch(["Penang"], "123 Jalan Ampang, KL")
// Returns: false
```

#### `filterTrainersByLocation(trainers, merchantAddress): Trainer[]`
Filters trainers array to only those covering the merchant's location.

```typescript
const trainers = [
  { name: "Nezo", location: ["Kuala Lumpur", "Selangor"] },
  { name: "Jia En", location: ["Penang"] }
]

filterTrainersByLocation(trainers, "123 Jalan Ampang, Kuala Lumpur")
// Returns: [{ name: "Nezo", ... }]
```

## Fallback Behavior

### When Location Cannot Be Determined

If the system cannot extract a location from the merchant's address:
1. **Default to showing all trainers** (don't block bookings)
2. **Log a warning** for manual review
3. **Allow booking to proceed** (better to have a booking than block it)

### When Trainer Has No Location Restrictions

If a trainer's `location` field is empty or undefined:
- Trainer is considered **available for all locations**
- Useful for trainers who can travel anywhere

## UI/UX Considerations

### Current Behavior

- Location filtering happens **automatically in the background**
- Users don't need to select location manually
- System extracts location from merchant address
- Only shows trainers who cover that location

### Future Enhancements

Potential improvements for future versions:

1. **Location Display**
   - Show matched location in UI
   - Display which trainers cover which areas

2. **Manual Override**
   - Allow admin to override location matching
   - Useful for special cases or remote training

3. **Location Validation**
   - Warn if address doesn't contain a recognizable state
   - Suggest address correction

4. **Multi-Location Support**
   - Handle merchants with multiple locations
   - Allow selecting which location for training

## Testing

### Test Cases

1. **Kuala Lumpur Merchant**
   ```
   Address: "123 Jalan Ampang, Kuala Lumpur"
   Expected: Only Nezo available
   ```

2. **Selangor Merchant**
   ```
   Address: "456 Jalan Sultan, Petaling Jaya, Selangor"
   Expected: Only Nezo available
   ```

3. **Penang Merchant**
   ```
   Address: "789 Lebuh Chulia, Georgetown, Penang"
   Expected: Only Jia En available
   ```

4. **Johor Merchant**
   ```
   Address: "321 Jalan Tun Razak, Johor Bahru, Johor"
   Expected: Only Izzudin available
   ```

5. **Unknown Location**
   ```
   Address: "123 Main Street"
   Expected: All trainers available (fallback)
   ```

6. **No Address**
   ```
   Address: null
   Expected: All trainers available (fallback)
   ```

### Manual Testing Steps

1. Create test merchants with different addresses
2. Open booking modal for each merchant
3. Verify only appropriate trainers show availability
4. Check that language filtering still works
5. Verify booking completes successfully

## Migration Notes

### Backward Compatibility

- **Existing trainers without location**: Treated as available everywhere
- **Existing merchants**: Location extracted from existing address field
- **No database changes required**: All configuration in JSON files

### Deployment

1. ✅ Update `config/trainers.json` with locations
2. ✅ Add `lib/location-matcher.ts` utility
3. ✅ Update `lib/trainer-availability.ts` logic
4. ⏳ Test with sample addresses
5. ⏳ Deploy to production
6. ⏳ Monitor for location matching issues

## Troubleshooting

### Issue: Trainer not showing for correct location

**Possible Causes**:
1. Address doesn't contain state name
2. State name uses uncommon variation
3. Typo in address

**Solution**:
- Check address format
- Add variation to `MALAYSIAN_STATES` mapping
- Use manual override if needed

### Issue: All trainers showing (should be filtered)

**Possible Causes**:
1. Location extraction failed
2. Trainer has no location restrictions
3. Address is null/empty

**Solution**:
- Check console logs for extraction results
- Verify trainer configuration
- Ensure address field is populated

## Related Documentation

- [Training Calendar System](./training-calendar.md)
- [Trainer Information](./trainer-information.md)
- [Time Slot Changes](./TIME-SLOT-CHANGES.md)

---

*Last Updated: 2025-10-15*  
*Document Owner: Development Team*

