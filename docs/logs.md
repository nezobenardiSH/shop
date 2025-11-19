🔗 Connecting to Salesforce at: https://storehub.my.salesforce.com/
Connecting to Salesforce with username/password...
 GET /merchant/a0yQ900000C0bez?stage=preparation 200 in 651ms
 GET /admin/analytics/a0yQ900000C0bezIAB 200 in 652ms
[Middleware] Processing path: /merchant/a0yQ900000C0bez
[Middleware] Protecting merchant route: /merchant/a0yQ900000C0bez
[Middleware] Found auth token, verifying...
[Middleware] Processing path: /admin/analytics/a0yQ900000C0bezIAB
[Middleware] Protecting admin route: /admin/analytics/a0yQ900000C0bezIAB
[Middleware] Found admin token, verifying...
[Middleware] Token valid for merchant: a0yQ900000C0bezIAB
[Middleware] Admin token valid
 GET /merchant/a0yQ900000C0bez?stage=preparation 200 in 10ms
 GET /admin/analytics/a0yQ900000C0bezIAB 200 in 11ms
Salesforce connection established successfully
[Stage Progression API] Found merchant: a0yQ900000C0bezIAB {
  productSetupStatus: null,
  menuSubmissionTimestamp: '2025-11-14T07:14:24.000+0000',
  videoProofLink: 'https://storehub.my.salesforce.com/sfc/servlet.shepherd/version/download/068Q900001DUBm4IAH',
  hardwareInstallationStatus: null,
  trainingStatus: null,
  installationDate: '2025-11-19',
  trainingDate: '2025-11-20'
}
[Stage Progression] Found 107 activities for merchant a0yQ900000C0bezIAB
[Stage Progression] Salesforce data: {
  productSetupStatus: null,
  menuSubmissionTimestamp: '2025-11-14T07:14:24.000+0000',
  videoProofLink: 'https://storehub.my.salesforce.com/sfc/servlet.shepherd/version/download/068Q900001DUBm4IAH',
  installationStatus: null,
  trainingStatus: null,
  installationDate: '2025-11-19',
  trainingDate: '2025-11-20'
}
[Stage Progression] Product Setup check: {
  menuSubmissionTimestamp: '2025-11-14T07:14:24.000+0000',
  productSetupStatus: null,
  hasMenuSubmitted: true
}
[Stage Progression] Added Product Setup to progression
[Stage Progression] Store Setup check: {
  videoProofLink: 'https://storehub.my.salesforce.com/sfc/servlet.shepherd/version/download/068Q900001DUBm4IAH',
  hasVideoProof: true
}
[Stage Progression] Added Store Setup to progression
[Stage Progression] Installation check: {
  installationStatus: null,
  installationDate: '2025-11-19',
  hasInstallation: '2025-11-19'
}
[Stage Progression] Added Installation to progression
[Stage Progression] Training check: {
  trainingStatus: null,
  trainingDate: '2025-11-20',
  hasTraining: '2025-11-20'
}
[Stage Progression] Added Training to progression
[Stage Progression] Returning events: [
  {
    stage: 'Product Setup',
    status: 'Done',
    timestamp: 2025-11-14T07:14:24.000Z,
    actor: 'unknown'
  },
  {
    stage: 'Store Setup',
    status: 'Done',
    timestamp: null,
    actor: 'unknown'
  },
  {
    stage: 'Installation',
    status: 'Scheduled',
    timestamp: null,
    actor: 'unknown'
  },
  {
    stage: 'Training',
    status: 'Scheduled',
    timestamp: 2025-11-15T02:09:08.304Z,
    actor: 'merchant'
  }
]
 GET /api/admin/analytics/stage-progression?merchantId=a0yQ900000C0bezIAB 200 in 2859ms
 GET /api/admin/analytics?startDate=2025-10-18T07%3A21%3A35.572Z&endDate=2025-11-17T07%3A21%3A35.572Z&merchantId=a0yQ900000C0bezIAB&groupBy=day&limit=1000 200 in 3967ms
 ✓ Compiled in 155ms (816 modules)
[Middleware] Processing path: /admin/analytics/a0yQ900000C0bezIAB
[Middleware] Protecting admin route: /admin/analytics/a0yQ900000C0bezIAB
[Middleware] Found admin token, verifying...
[Middleware] Admin token valid
[Middleware] Processing path: /merchant/a0yQ900000C0bez
[Middleware] Protecting merchant route: /merchant/a0yQ900000C0bez
[Middleware] Found auth token, verifying...
[Middleware] Token valid for merchant: a0yQ900000C0bezIAB
 GET /admin/analytics/a0yQ900000C0bezIAB 200 in 42ms
 GET /merchant/a0yQ900000C0bez?stage=preparation 200 in 43ms
 ✓ Compiled in 221ms (816 modules)
[Middleware] Processing path: /merchant/a0yQ900000C0bez
[Middleware] Protecting merchant route: /merchant/a0yQ900000C0bez
[Middleware] Found auth token, verifying...
[Middleware] Processing path: /admin/analytics/a0yQ900000C0bezIAB
[Middleware] Protecting admin route: /admin/analytics/a0yQ900000C0bezIAB
[Middleware] Found admin token, verifying...
[Middleware] Token valid for merchant: a0yQ900000C0bezIAB
[Middleware] Admin token valid
 GET /merchant/a0yQ900000C0bez?stage=preparation 200 in 48ms
 GET /admin/analytics/a0yQ900000C0bezIAB 200 in 47ms
 GET /api/admin/analytics?startDate=2025-10-18T07%3A23%3A07.685Z&endDate=2025-11-17T07%3A23%3A07.685Z&merchantId=a0yQ900000C0bezIAB&isInternalUser=false&groupBy=day&limit=1000 200 in 4301ms
[Middleware] Processing path: /.well-known/appspecific/com.chrome.devtools.json
 GET /.well-known/appspecific/com.chrome.devtools.json 404 in 29ms