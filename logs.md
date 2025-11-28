🔍 [SURFTEK-DEBUG] Merchant query returned 1 records
🔍 [SURFTEK-DEBUG] MSM lookup result:
   - MSM_Name__r object: {"attributes":{"type":"User","url":"/services/data/v50.0/sobjects/User/0052w000006lAACAA2"},"Email":"john.wong@storehub.com","Name":"John Wong","Phone":null}
   - msmEmail: john.wong@storehub.com
   - msmName: John Wong
   - merchantEmail: ryan.foo@storehub.com
📧 Notifying onboarding manager: John Wong (john.wong@storehub.com)
📱 Detecting device type...
   Order items: 498
   Summary length: 53 chars
📱 Found Android device in order: Discount for IMIN D4 (Advance Plan-Yearly)
📱 Device type from order: android
📱 Detected device type: android
🎫 Creating Surftek ticket...
📍 Geocoding address: KYM, Melaka, Melaka, 47800, Malaysia
📍 Geocoded successfully: lat=2.2289043, lng=102.2664203
📋 Creating Surftek ticket...
   Store: activate175
   Contact: Ryan Foo
   Phone: 601126188063
   ServiceId: 39
   Address: KYM, Melaka, Melaka, 47800, Malaysia
   State: Melaka
   Coordinates: 2.2289043, 102.2664203
📤 Full Surftek request: {
  "Ticket": {
    "Name": "Ryan Foo",
    "Phone": "601126188063",
    "Issue": "*Onsite Support",
    "Priority": 0,
    "IsReceiveSms": true,
    "Email": "ryan.foo@storehub.com",
    "Remark": "Hardware:\n- Software Monthly (Advance Plan) (Qty: 1)\n- Onboarding Service - Onsite Training (Qty: 1)\n- Onboarding Service - Product Setup (Qty: 1)\n- Onboarding Service - Online Training (Qty: 1)\n- Onboarding Service - Extra Store (Qty: 1)\n- VIP Onboarding Service (Discount) (Qty: 1)\n- VIP Onboarding Service (Product Setup) (Qty: 1)\n- VIP Onboarding Service (Discount) (Qty: 1)\n- VIP Onboarding Service (Product Setup) (Qty: 1)\n- VIP Onboarding Service (Discount) (Qty: 1)\n- VIP Onboarding Service (Product Setup) (Qty: 1)\n- Discount for IMIN D4 (Advance Plan-Yearly) (Qty: 1)\n- ITPP047 Thermal Receipt Printer (Qty: 1)\n- Software Yearly (Advance Plan) (Qty: 1)\n- IMIN D4-504 POS 15.6\" + 10.1\" (Qty: 1)\n- Discount for hardwares (Qty: 1)\n- VIP Onboarding Service (Discount) (Qty: 1)\n- VIP Onboarding Service (Product Setup) (Qty: 1)\n- Software Yearly (Advance Plan) (Qty: 2)\n- Discount for hardwares (Qty: 1)\n- ITPP047 Thermal Receipt Printer (Qty: 1)\n- IMIN D4-504 POS 15.6\" + 10.1\" (Qty: 1)\n- Di...",
    "StoreName": "activate175",
    "DealerReseller": "StoreHub"
  },
  "Appointment": {
    "Address": "KYM, Melaka, Melaka, 47800, Malaysia",
    "State": "Melaka",
    "ServiceId": 39,
    "Longitude": 102.2664203,
    "Latitude": 2.2289043
  }
}
🔍 DEBUG - Ticket fields:
   Name length: 8 - value: Ryan Foo
   Phone length: 12 - value: 601126188063
   Issue length: 15
   Priority: 0 - type: number
   IsReceiveSms: true - type: boolean
   Email: ryan.foo@storehub.com
   Remark length: 1000
   StoreName length: 11 - value: activate175
   DealerReseller: StoreHub
🔍 DEBUG - Appointment fields:
   Address length: 36 - value: KYM, Melaka, Melaka, 47800, Malaysia
   State length: 6 - value: Melaka
   ServiceId: 39 - type: number
   Longitude: 102.2664203 - type: number
   Latitude: 2.2289043 - type: number
❌ Surftek API error: Invalid parameter
   ErrorMessage: Invalid input parameters
⚠️ Surftek ticket creation failed, falling back to manual flow