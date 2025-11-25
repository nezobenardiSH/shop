## Create Ticket API Document
```
(storehub.trackking.biz)
```
23-Nov-2025
1. Request
```
URL:
```
```
https://storehub.trackking.biz/api/ticket/create
```
```
Method:
```
POST
```
Headers:
```
```
{
```
"Authorization": "Bearer
tk_f6s4TiMhef7c64FU6wbV1Kt2VurFYkP69G7t"
```
}
```
```
Body:
```
```
{
```
```
"Ticket": {
```
"Name": "Ahmad Ibrahim",
"Phone": "60123456789",
"Issue": "*Onsite Support",
"Priority": 0,
"IsReceiveSms": true,
"Email": "ahmad_ibrahim@gmail.com",
"Remark": "Describe your issue",
"StoreName": "KL Branch",
"DealerReseller": "Alex"
```
},
```
```
"Appointment": {
```
"Address": "23, Jalan Ampang, Taman KLCC, 55000 KL",
"State": "Kuala Lumpur",
"ServiceId": 1,
"Longitude": 101.7122,
"Latitude": 3.1573
```
}
```
```
}
```
Ticket Parameters Mandatory Data Type Max Length
Name Yes String 100
Phone Yes String 16
Issue Yes String 500
Priority Yes Integer
-1 Low
0 Normal
1 High
N/A
IsReceiveSms Yes Boolean N/A
Email No String 100
Remark No String 1000
StoreName No String 100
DealerReseller No String 50
Appointment
Parameters
Mandatory Data Type Max Length
Address Yes String 500
State Yes String 50
ServiceId Yes Integer
1 IOS HARDWARE
N/A
INSTALLATION
```
(ON-SITE
```
```
DEPLOYMENT)
```
2 PRE-INSTALLATION
INSPECTION
3 DAY 1 SUPPORT FOR
VIP ONBOARDING
MERCHANTS
18 ON-SITE
TROUBLESHOOTING
SUPPORT
23 POS SWAP
39 ANDROID HARDWARE
INSTALLATION
```
(ON-SITE
```
```
DEPLOYMENT)
```
Longitude Yes Integer N/A
Latitude Yes Integer N/A
2. Response
Success
```
{
```
"ErrorCode": "0",
```
"Ticket": {
```
"TicketId": 999,
"CaseNum": "STOREHUB0999-CA109193B",
...
...
```
}
```
```
}
```
Fail
```
{
```
"ErrorCode": "-10008",
"ErrorMessage": "Unexpected error"
```
}
```
ErrorCode Description
0 Success
-10000 Invalid parameter
-10001 Invalid passcode
-10002 Invalid IP
-10003 Invalid auth code
-10004 Too many request
-10005 User banned
-10006 Network failure
-10007 Invalid authorization
-10008 Unexpected error
-10009 Http request fail
-10010 Invalid session
-10011 User not found
-10012 Invalid license
-10013 File not found
-10014 Invalid onsites API key
-10015 Session expired
-10016 Account expired