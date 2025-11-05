# Analytics Dashboard Implementation Plan

## Overview
Implement a comprehensive analytics tracking system and dashboard at `/admin/analytics` to measure portal traffic, track merchant engagement, and monitor feature usage.

## Goals
- Track page views per merchant
- Monitor login activity and authentication patterns
- Measure feature usage (bookings, uploads, etc.)
- Provide actionable insights through visual dashboard
- Maintain privacy and data security

---

## Phase 1: Database Schema & Tracking Infrastructure

### Status: ⬜ Not Started

### 1.1 Create Analytics Database Schema
**File**: `prisma/schema.prisma`

Add new `PageView` model:
```prisma
model PageView {
  id            String   @id @default(cuid())
  merchantId    String?  // Salesforce ID (nullable for login page visits)
  merchantName  String?  // Cached for easier querying
  page          String   // 'progress', 'details', 'login', 'admin', etc.
  action        String?  // 'view', 'login_success', 'login_failed', 'booking', 'upload'
  userAgent     String?  @db.Text
  ipAddress     String?  // For unique visitor tracking (optional)
  sessionId     String   // To track unique sessions
  metadata      Json?    // Additional context (e.g., booking details, error messages)
  timestamp     DateTime @default(now())
  createdAt     DateTime @default(now())
  
  @@index([merchantId])
  @@index([page])
  @@index([timestamp])
  @@index([sessionId])
}
```

**Actions**:
- [ ] Add PageView model to schema
- [ ] Run `npx prisma migrate dev --name add_analytics_tracking`
- [ ] Run `npx prisma generate`
- [ ] Verify migration successful

---

### 1.2 Create Tracking Utility Functions
**File**: `lib/analytics.ts` (NEW)

Functions to implement:
- `trackPageView(data)` - Log page visits to database
- `trackEvent(data)` - Log specific actions
- `generateSessionId()` - Create/retrieve session ID from cookies
- `getClientInfo(request)` - Extract user agent, IP address

**Key Features**:
- Async/non-blocking (don't slow down page loads)
- Error handling (tracking failures shouldn't break the app)
- Session management (24-hour session window)
- Privacy-conscious (hash IP addresses)

**Actions**:
- [ ] Create `lib/analytics.ts`
- [ ] Implement tracking functions
- [ ] Add error handling and logging
- [ ] Test tracking functions work correctly

---

### 1.3 Integrate Tracking into Middleware
**File**: `middleware.ts`

Add tracking for:
- Merchant page access (`/merchant/[merchantId]/*`)
- Login page visits (`/login/[merchantId]`)
- Admin page access (`/admin/*`)

**Implementation Notes**:
- Track AFTER authentication check passes
- Don't track API routes (`/api/*`)
- Don't track static assets
- Extract merchantId from URL path
- Use fire-and-forget pattern (don't await)

**Actions**:
- [ ] Import analytics functions
- [ ] Add tracking calls in appropriate places
- [ ] Test middleware still works correctly
- [ ] Verify data is being logged

---

### 1.4 Integrate Tracking into Key Pages
**Files to modify**:
- `app/merchant/[merchantId]/page.tsx` (progress page)
- `app/merchant/[merchantId]/details/page.tsx` (details page)
- `app/login/[merchantId]/page.tsx` (login page)

**Events to track**:
- Page load/view
- Successful login (`action: 'login_success'`)
- Failed login (`action: 'login_failed'`)
- Booking created (`action: 'booking_created'`)
- File uploaded (`action: 'file_uploaded'`)
- Form submission (`action: 'form_submitted'`)

**Actions**:
- [ ] Add client-side tracking to merchant pages
- [ ] Track login success/failure in auth API
- [ ] Track booking creation
- [ ] Track file uploads
- [ ] Test events are logged correctly

---

### 1.5 Phase 1 Validation
**Actions**:
- [ ] Visit merchant pages and verify PageView records created
- [ ] Check timestamps are correct (timezone handling)
- [ ] Verify sessionId is consistent within same session
- [ ] Test with multiple merchants
- [ ] Query database to confirm data structure

---

## Phase 2: Analytics API Endpoints

### Status: ⬜ Not Started

### 2.1 Create Analytics Query API
**File**: `app/api/admin/analytics/route.ts` (NEW)

**Endpoint**: `GET /api/admin/analytics`

**Query Parameters**:
- `startDate` (ISO string, default: 30 days ago)
- `endDate` (ISO string, default: now)
- `merchantId` (optional, filter by specific merchant)
- `page` (optional, filter by page type)
- `action` (optional, filter by action type)
- `groupBy` (optional: 'day', 'week', 'month')

**Response Format**:
```json
{
  "summary": {
    "totalPageViews": 1234,
    "uniqueMerchants": 45,
    "uniqueSessions": 678,
    "avgPagesPerSession": 3.2
  },
  "timeSeriesData": [...],
  "topMerchants": [...],
  "pageBreakdown": [...],
  "recentActivity": [...]
}
```

**Actions**:
- [ ] Create API route file
- [ ] Add admin authentication check
- [ ] Implement query parameter parsing
- [ ] Call analytics query functions
- [ ] Return formatted JSON response
- [ ] Add error handling

---

### 2.2 Implement Analytics Aggregation Functions
**File**: `lib/analytics-queries.ts` (NEW)

Functions to implement:

1. **`getSummaryStats(filters)`**
   - Total page views
   - Unique merchants
   - Unique sessions
   - Average pages per session

2. **`getTimeSeriesData(filters, groupBy)`**
   - Page views grouped by day/week/month
   - Format for chart rendering

3. **`getTopMerchants(filters, limit)`**
   - Top N merchants by page views
   - Include merchant name, total views, last visit

4. **`getPageBreakdown(filters)`**
   - Page views by page type
   - Percentage distribution

5. **`getRecentActivity(filters, limit)`**
   - Latest N page views
   - Include merchant, page, timestamp

6. **`getLoginActivity(filters)`**
   - Login success vs failure rates
   - Failed login attempts by merchant

**Actions**:
- [ ] Create `lib/analytics-queries.ts`
- [ ] Implement all query functions
- [ ] Optimize queries with proper indexes
- [ ] Add TypeScript types for return values
- [ ] Test queries with sample data

---

### 2.3 Phase 2 Validation
**Actions**:
- [ ] Test API endpoint with Postman/curl
- [ ] Verify authentication works (admin-only)
- [ ] Test different filter combinations
- [ ] Check query performance
- [ ] Validate response data accuracy

---

## Phase 3: Analytics Dashboard UI

### Status: ⬜ Not Started

### 3.1 Install Dependencies
**File**: `package.json`

**Actions**:
- [ ] Run `npm install recharts date-fns`
- [ ] Verify installation successful

---

### 3.2 Create Analytics Page Structure
**File**: `app/admin/analytics/page.tsx` (NEW)

**Page Structure**:
- Admin authentication check
- Page header with title and navigation
- Date range picker
- Refresh button
- Loading states
- Error handling

**Actions**:
- [ ] Create page file
- [ ] Add admin auth check
- [ ] Implement data fetching
- [ ] Add loading/error states
- [ ] Style with StoreHub design system

---

### 3.3 Build Dashboard Components

#### Component 1: Stats Cards
**File**: `components/analytics/StatsCard.tsx` (NEW)

Display key metrics in card format:
- Total Page Views
- Unique Merchants
- Unique Sessions
- Avg. Pages per Session

**Actions**:
- [ ] Create component
- [ ] Add icons and styling
- [ ] Handle loading states
- [ ] Add percentage change indicators (optional)

---

#### Component 2: Traffic Chart
**File**: `components/analytics/TrafficChart.tsx` (NEW)

Line chart showing page views over time using Recharts.

**Features**:
- X-axis: Date
- Y-axis: Page views
- Tooltip on hover
- Responsive design

**Actions**:
- [ ] Create component
- [ ] Integrate Recharts LineChart
- [ ] Format data for chart
- [ ] Add styling and responsiveness

---

#### Component 3: Top Merchants Table
**File**: `components/analytics/TopMerchantsTable.tsx` (NEW)

Table showing top 10 merchants by traffic.

**Columns**:
- Merchant Name
- Total Page Views
- Last Visit
- Link to merchant page

**Actions**:
- [ ] Create component
- [ ] Build table structure
- [ ] Add sorting capability
- [ ] Style with StoreHub design
- [ ] Add click-through links

---

#### Component 4: Page Breakdown Chart
**File**: `components/analytics/PageBreakdownChart.tsx` (NEW)

Bar chart showing page views by page type.

**Actions**:
- [ ] Create component
- [ ] Integrate Recharts BarChart
- [ ] Format data
- [ ] Add colors and labels

---

#### Component 5: Recent Activity Feed
**File**: `components/analytics/RecentActivityFeed.tsx` (NEW)

Scrollable list of recent page views.

**Display**:
- Merchant name
- Page visited
- Action taken
- Timestamp (relative, e.g., "2 minutes ago")

**Actions**:
- [ ] Create component
- [ ] Format timestamps with date-fns
- [ ] Add scrollable container
- [ ] Style activity items

---

#### Component 6: Date Range Picker
**File**: `components/analytics/DateRangePicker.tsx` (NEW)

Filter analytics by date range.

**Presets**:
- Last 7 days
- Last 30 days
- Last 90 days
- Custom range

**Actions**:
- [ ] Create component
- [ ] Add preset buttons
- [ ] Add custom date inputs
- [ ] Handle date changes
- [ ] Style with StoreHub design

---

### 3.4 Implement Dashboard Layout
**File**: `app/admin/analytics/page.tsx`

**Layout Structure**:
```
┌─────────────────────────────────────────┐
│ Header: Analytics Dashboard             │
│ [Date Range Picker] [Refresh Button]    │
└─────────────────────────────────────────┘
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ Card │ │ Card │ │ Card │ │ Card │
└──────┘ └──────┘ └──────┘ └──────┘
┌─────────────────────────────────────────┐
│ Traffic Over Time (Line Chart)          │
└─────────────────────────────────────────┘
┌──────────────────┐ ┌──────────────────┐
│ Page Breakdown   │ │ Recent Activity  │
│ (Bar Chart)      │ │ (Feed)           │
└──────────────────┘ └──────────────────┘
┌─────────────────────────────────────────┐
│ Top Merchants (Table)                   │
└─────────────────────────────────────────┘
```

**Actions**:
- [ ] Arrange components in grid layout
- [ ] Make responsive for mobile
- [ ] Add spacing and padding
- [ ] Test on different screen sizes

---

### 3.5 Add Navigation from Main Admin Page
**File**: `app/admin/page.tsx`

Add "Analytics" button/link to navigate to `/admin/analytics`.

**Actions**:
- [ ] Add Analytics navigation button
- [ ] Add icon (📊)
- [ ] Style consistently with existing buttons
- [ ] Test navigation works

---

### 3.6 Phase 3 Validation
**Actions**:
- [ ] Verify all components render correctly
- [ ] Test date range filtering
- [ ] Check charts display accurate data
- [ ] Test responsive design on mobile
- [ ] Verify loading states work
- [ ] Test error handling
- [ ] Check empty state (no data)

---

## Phase 4: Testing & Validation

### Status: ⬜ Not Started

### 4.1 End-to-End Testing
**Actions**:
- [ ] Generate test data (visit multiple merchant pages)
- [ ] Verify data appears in dashboard
- [ ] Test all filters and date ranges
- [ ] Verify charts update correctly
- [ ] Test with different merchants
- [ ] Check performance with larger datasets

---

### 4.2 Edge Cases & Error Handling
**Actions**:
- [ ] Test with no data (empty state)
- [ ] Test with invalid date ranges
- [ ] Test with very large date ranges
- [ ] Test unauthorized access (non-admin)
- [ ] Test database connection failures
- [ ] Verify error messages are user-friendly

---

### 4.3 Performance Testing
**Actions**:
- [ ] Check page load time
- [ ] Verify queries are optimized
- [ ] Test with 1000+ page views
- [ ] Check for memory leaks
- [ ] Optimize slow queries if needed

---

### 4.4 Documentation
**Actions**:
- [ ] Document analytics features in README
- [ ] Add privacy notes (what data is tracked)
- [ ] Document how to access analytics
- [ ] Add screenshots to documentation

---

## Files Summary

### New Files (11):
1. `lib/analytics.ts` - Tracking utilities
2. `lib/analytics-queries.ts` - Data aggregation functions
3. `app/api/admin/analytics/route.ts` - Analytics API endpoint
4. `app/admin/analytics/page.tsx` - Analytics dashboard page
5. `components/analytics/StatsCard.tsx` - Metric cards
6. `components/analytics/TrafficChart.tsx` - Line chart component
7. `components/analytics/TopMerchantsTable.tsx` - Merchants table
8. `components/analytics/PageBreakdownChart.tsx` - Bar chart
9. `components/analytics/RecentActivityFeed.tsx` - Activity feed
10. `components/analytics/DateRangePicker.tsx` - Date filter

### Modified Files (4):
1. `prisma/schema.prisma` - Add PageView model
2. `middleware.ts` - Add tracking calls
3. `app/admin/page.tsx` - Add analytics navigation
4. `package.json` - Add recharts, date-fns

---

## Privacy & Security Considerations

- **IP Address Hashing**: Hash IP addresses before storing (optional)
- **Data Retention**: Consider adding cleanup job for old analytics data
- **Admin-Only Access**: Analytics dashboard only accessible by admin
- **No PII**: Don't track sensitive personal information
- **Session Privacy**: Session IDs are random, not tied to user identity

---

## Future Enhancements (Post-MVP)

- Export to CSV functionality
- Email reports (weekly/monthly summaries)
- Real-time dashboard updates (WebSocket)
- Funnel analysis (login → booking → go-live)
- A/B testing support
- Custom event tracking
- Merchant-specific analytics (merchants can see their own data)

---

## Estimated Timeline

- **Phase 1**: 30-45 minutes
- **Phase 2**: 20-30 minutes
- **Phase 3**: 45-60 minutes
- **Phase 4**: 15-20 minutes
- **Total**: ~2-2.5 hours

---

## Success Criteria

✅ Analytics data is tracked automatically for all page visits
✅ Dashboard displays accurate metrics and charts
✅ Admin can filter by date range and merchant
✅ Dashboard is responsive and performs well
✅ Only admin users can access analytics
✅ No impact on page load performance for merchants

---

**Document Version**: 1.0
**Created**: 2025-11-05
**Status**: Ready for Implementation

