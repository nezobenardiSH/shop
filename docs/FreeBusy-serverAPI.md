# Query availability of the primary calendar

Call this interface to query the busy/free information of the specified user's primary calendar, or to query the busy/free information of the specified meeting room.

**Notice**：If you call this interface using the application identity, you need to ensure that the application has [Bot capabilities](https://open.larksuite.com/document/uAjLw4CM/ugTN1YjL4UTN24CO1UjN/trouble-shooting/how-to-enable-bot-ability).

## Request

Facts | 
---|---
HTTP URL | https://open.larksuite.com/open-apis/calendar/v4/freebusy/list
HTTP Method | POST
Rate Limit | [1000 per minute、50 per second](https://open.larksuite.com/document/ukTMukTMukTM/uUzN04SN3QjL1cDN)
Supported app types | Custom App、Store App
Required scopes<br>**To use this API, you must have at least 1 of the listed scopes.**<br>Enable any scope from the list | Update calendar and event information(calendar:calendar)<br>View availability in calendar(calendar:calendar.free_busy:read)<br>Obtain calendar, event, and availability information(calendar:calendar:readonly)
Required field scopes | **Notice**：The response body of the API contains the following sensitive fields, and they will be returned only after corresponding scopes are added. If you do not need the fields, it is not recommended that you request the scopes.<br>Obtain user ID(contact:user.employee_id:readonly)

### Request header

Parameter | Type | Required | Description
---|---|---|---
Authorization | string | Yes | `tenant_access_token`<br>or<br>`user_access_token`<br>**Value format**: "Bearer `access_token`"<br>**Example value**: "Bearer u-7f1bcd13fc57d46bac21793a18e560"<br>[How to choose and get access token](https://open.larksuite.com/document/uAjLw4CM/ugTN1YjL4UTN24CO1UjN/trouble-shooting/how-to-choose-which-type-of-token-to-use)
Content-Type | string | Yes | **Fixed value**: "application/json; charset=utf-8"

### Query parameters

Parameter | Type | Required | Description
---|---|---|---
user_id_type | string | No | User ID categories<br>**Example value**: open_id<br>**Optional values are**:<br>- open_id：Identifies a user to an app. The same user has different Open IDs in different apps. [How to get Open ID](https://open.larksuite.com/document/uAjLw4CM/ugTN1YjL4UTN24CO1UjN/trouble-shooting/how-to-obtain-openid)<br>- union_id：Identifies a user to a tenant that acts as a developer. A user has the same Union ID in apps developed by the same developer, and has different Union IDs in apps developed by different developers. A developer can use Union ID to link the same user's identities in multiple apps.[How to get Union ID](https://open.larksuite.com/document/uAjLw4CM/ugTN1YjL4UTN24CO1UjN/trouble-shooting/how-to-obtain-union-id)<br>- user_id：Identifies a user to a tenant. The same user has different User IDs in different tenants. In one single tenant, a user has the same User ID in all apps （including store apps）. User ID is usually used to communicate user data between different apps. [How to get User ID](https://open.larksuite.com/document/uAjLw4CM/ugTN1YjL4UTN24CO1UjN/trouble-shooting/how-to-obtain-user-id)<br>**Default value**: `open_id`<br>**When the value is `user_id`, the following field scopes are required**:<br>Obtain user ID(contact:user.employee_id:readonly)

### Request body

Parameter | Type | Required | Description
---|---|---|---
time_min | string | Yes | The start time of the query period, in [RFC 3339](https://datatracker.ietf.org/doc/html/rfc3339) date_time format.<br>**Note**: The time interval between time_min and time_max cannot be more than 90 days.<br>**Example value**: "2020-10-28T12:00:00+08:00"
time_max | string | Yes | The end time of the query period, in [RFC 3339](https://datatracker.ietf.org/doc/html/rfc3339) date_time format.<br>**Note**: The time interval between time_min and time_max cannot be more than 90 days.<br>**Example value**: "2020-12-28T12:00:00+08:00"
user_id | string | No | User ID, you need to input an id that matches the query parameter user_id_type. For example, when user_id_type=open_id, you need to input the user's open_id. Refer to [User-related ID concepts](https://open.larksuite.com/document/home/user-identity-introduction/introduction) for understanding user IDs.<br>**Note**: Either user_id or room_id needs to be entered. If both are entered at the same time, only user_id will take effect.<br>**Example value**: "ou_xxxxxxxxxx"
room_id | string | No | Meeting room room_id. You can call the [Query Meeting Room List](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/vc-v1/room/list) interface or the [Search for Meeting Room](https://open.larksuite.com/document/uAjLw4CM/ukTMukTMukTM/reference/vc-v1/room/search) interface to get the corresponding meeting room's room_id.<br>**Note**: Either user_id or room_id needs to be entered. If both are entered at the same time, only user_id will take effect.<br>**Example value**: "omm_xxxxxxxxxx"
include_external_calendar | boolean | No | Whether to include the schedule in the bound third-party calendar.<br>**Values**：<br>- true (default value): Include<br>- false: Do not include<br>**Example value**: true
only_busy | boolean | No | Whether to only query busy schedule information.<br>**Value**:<br>- true (default): Yes, the query results do not include free schedules.<br>- false: No, the query results include free schedules.<br>**Example value**: true

### Request body example
```json
{
    "time_min": "2020-10-28T12:00:00+08:00",
    "time_max": "2020-12-28T12:00:00+08:00",
    "user_id": "ou_xxxxxxxxxx",
    "room_id": "omm_xxxxxxxxxx",
    "include_external_calendar": true,
    "only_busy": true
}
```

## Response

### Response body

Parameter | Type | Description
---|---|---
code | int | Error codes, fail if not zero
msg | string | Error descriptions
data | \- | \-
freebusy_list | freebusy\[\] | List of busy time periods within the requested time interval.
start_time | string | Start time of the availability information. The value must be in the same format as specified in the date_time parameter in [RFC 3339](https://datatracker.ietf.org/doc/html/rfc3339).
end_time | string | End time of the availability information. The value must be in the same format as specified in the date_time parameter in [RFC 3339](https://datatracker.ietf.org/doc/html/rfc3339).

### Response body example
```json
{
    "code": 0,
    "msg": "success",
    "data": {
        "freebusy_list": [
            {
                "start_time": "2020-10-28T22:30:00+08:00",
                "end_time": "2020-10-28T22:45:00+08:00"
            }
        ]
    }
}
```

### Error code

HTTP status code | Error code | Description | Troubleshooting suggestions
---|---|---|---
400 | 190002 | invalid parameters in request | Invalid request parameters. Troubleshooting suggestions are as follows:<br>- Confirm that the field name and parameter type of the request parameter are correct.<br>- Confirm that the permissions for the corresponding resource have been applied for.<br>- Confirm that the corresponding resource has not been deleted.
500 | 190003 | internal service error | Internal service error, please contact [Technical Support](https://applink.larksuite.com/TLJpeNdW).
429 | 190004 | method rate limited | Method frequency limit. It is recommended to try again later and reduce the request QPS appropriately.
429 | 190005 | app rate limited | Frequency limiting is applied. We recommend that you try again later and reduce the request QPS appropriately.
403 | 190006 | wrong unit for app tenant | Request error, check whether the App ID and App Secret are correct. If the problem still cannot be solved, please consult [Technical Support](https://applink.larksuite.com/TLJpeNdW).
404 | 190007 | app bot_id not found | The bot_id of the application is not found. You need to make sure that the application has enabled [bot capability](https://open.larksuite.com/document/uAjLw4CM/ugTN1YjL4UTN24CO1UjN/trouble-shooting/how-to-enable-bot-ability). If the problem is still not solved, please contact [technical support](https://applink.larksuite.com/TLJpeNdW).
429 | 190010 | current operation rate limited | The current operation is limited, usually because concurrent preemption of public resources fails. You can appropriately reduce the frequency of the current operation and try again.
404 | 195100 | user is dismiss or not exist in the tenant | The current identity or specified user has resigned or is no longer in the tenant. Please check and change to the correct identity to call the interface.

For more error code information, see [General error codes](https://open.larksuite.com/document/ukTMukTMukTM/ugjM14COyUjL4ITN).
