# GA4 Content Grouping Reference

## Overview
Content groups categorize page views in Google Analytics 4 for easier analysis of user behavior across different sections of the portal.

---

## Content Group Mappings

| URL Pattern | Content Group | Description |
|-------------|---------------|-------------|
| `/` | `other` | Onboarding Portal Root |
| `/login/*` | `login` | Login pages |
| `/merchant/{id}/overview` | `overview` | Merchant overview page |
| `/merchant/{id}/details` | `details` | Merchant details page |
| `/merchant/{id}?stage=welcome` | `welcometostorehub` | Welcome stage |
| `/merchant/{id}?stage=preparation` | `progress-preparation` | Preparation stage |
| `/merchant/{id}?stage=installation` | `progress-installation` | Installation stage |
| `/merchant/{id}?stage=training` | `progress-training` | Training stage |
| `/merchant/{id}?stage=ready-go-live` | `progress-ready go live` | Ready to go live stage |
| `/merchant/{id}?stage=live` | `progress-live` | Live stage |
| `/merchant/{id}?stage=installation&booking=installation` | `installation booking` | Installation booking modal |
| `/merchant/{id}?stage=training&booking=training` | `training booking` | Training booking modal |
| All other pages | `other` | Uncategorized pages |

---

## Implementation Files

| File | Purpose |
|------|---------|
| `/lib/useContentGroup.ts` | Content group logic and URL matching |
| `/components/GoogleAnalytics.tsx` | Sends `content_group` parameter to GA4 |

---

## GA4 Configuration

### Custom Dimensions Setup

You need to create **two** custom dimensions in GA4:

#### 1. Content Group
- **Dimension name:** Content Group
- **Scope:** Event
- **Event parameter:** `content_group`

#### 2. User Type
- **Dimension name:** User Type
- **Scope:** Event
- **Event parameter:** `user_type`

### User Type Values

| Value | Description |
|-------|-------------|
| `merchant` | Merchant users (logged in with phone PIN) |
| `internal_team` | StoreHub internal team (logged in with internal PIN) |
| `anonymous` | Not logged in yet |

### Viewing in GA4
1. Go to **Reports** → **Engagement** → **Pages and screens**
2. Add "Content group" or "User type" as a secondary dimension
3. Or create a custom report with these as primary dimensions
4. Filter by User Type to see only merchant or internal team activity

---

## Adding New Content Groups

To add a new content group, edit `/lib/useContentGroup.ts`:

```typescript
// Example: Adding a new page type
if (pathname.endsWith("/new-page")) {
  return "new-page-group";
}

// Example: Adding a new stage
if (stage === "new-stage") return "progress-new-stage";
```

---

## Environment Variables

| Variable | Value | Platform |
|----------|-------|----------|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-FP3XZDT8ZH` | Render |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | `uiqcu24kcq` | Render |

---

## Notes

- Content groups only track in **production** (disabled on localhost)
- Data appears in GA4 reports within 24-48 hours
- Realtime reports show data immediately
- Both GA4 and Clarity are configured for production-only tracking
