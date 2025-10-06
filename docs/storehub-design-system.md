# StoreHub Design System

## 🎨 Color Palette

### Primary Colors
```css
--storehub-orange: #ff630f;        /* Primary brand color */
--storehub-orange-hover: #fe5b25;  /* Hover state for primary */
--storehub-orange-light: #fff4ed;  /* Light variant for backgrounds */
```

### Background Colors
```css
--bg-primary: #faf9f6;    /* Main background (off-white) */
--bg-white: #ffffff;      /* Card backgrounds */
--bg-gray: #f8f8f8;       /* Secondary backgrounds */
```

### Text Colors
```css
--text-primary: #0b0707;   /* Main text (deep black) */
--text-secondary: #6b6a6a; /* Secondary text (gray) */
--text-muted: #9ca3af;     /* Muted/disabled text */
--text-white: #ffffff;     /* White text on dark backgrounds */
```

### Status Colors
```css
--success: #10b981;  /* Green */
--error: #ef4444;    /* Red */
--warning: #f59e0b;  /* Amber */
--info: #3b82f6;     /* Blue */
```

### Border Colors
```css
--border-light: #e5e7eb;   /* Light borders */
--border-medium: #d1d5db;  /* Medium borders */
```

## 📝 Typography

### Font Family
```css
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Font Sizes
- **xs**: 12px (0.75rem) - Small labels, captions
- **sm**: 14px (0.875rem) - Secondary text, small buttons
- **base**: 16px (1rem) - Body text
- **lg**: 18px (1.125rem) - Emphasized body text
- **xl**: 20px (1.25rem) - Small headings
- **2xl**: 24px (1.5rem) - Section headings
- **3xl**: 30px (1.875rem) - Page headings
- **4xl**: 36px (2.25rem) - Large headings

### Font Weights
- **normal**: 400 - Body text
- **medium**: 500 - Emphasized text
- **semibold**: 600 - Subheadings
- **bold**: 700 - Headings

### Line Height
```css
line-height: 1.7;  /* For better readability */
```

## 🔘 Button Styles

### Primary Button
```html
<button class="btn-storehub-primary">
  Click Me
</button>
```
```css
/* Tailwind Classes */
bg-[#ff630f] hover:bg-[#fe5b25] text-white font-medium rounded-full 
px-6 py-2.5 transition-all duration-200 transform hover:scale-105
```

### Secondary Button
```html
<button class="btn-storehub-secondary">
  Click Me
</button>
```
```css
/* Tailwind Classes */
bg-white hover:bg-gray-50 text-[#0b0707] font-medium rounded-full 
px-6 py-2.5 border border-[#e5e7eb] transition-all duration-200
```

### Ghost Button
```html
<button class="btn-storehub-ghost">
  Click Me
</button>
```
```css
/* Tailwind Classes */
hover:bg-gray-100 text-[#6b6a6a] font-medium rounded-full 
px-4 py-2 transition-all duration-200
```

### Small Button
```css
px-4 py-1.5 text-sm
```

### Icon Button
```html
<button class="btn-storehub-icon">
  <svg>...</svg>
  <span>Button Text</span>
</button>
```
```css
/* Add to button classes */
flex items-center gap-2
```

## 📦 Card Components

### Basic Card
```html
<div class="card-storehub">
  <h3>Card Title</h3>
  <p>Card content goes here</p>
</div>
```
```css
/* Tailwind Classes */
bg-white rounded-2xl border border-[#e5e7eb] p-6
```

### Hoverable Card
```css
/* Add hover effect */
hover:shadow-lg transition-shadow duration-200
```

### Compact Card
```css
p-4 /* Instead of p-6 */
```

## 🏷️ Badge/Pill Styles

### Success Badge
```html
<span class="badge-success">Completed</span>
```
```css
bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium
```

### Warning Badge
```css
bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium
```

### Error Badge
```css
bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium
```

### Info Badge
```css
bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium
```

### Neutral Badge
```css
bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium
```

## 📏 Spacing

### Padding/Margin Scale
- **xs**: 8px (0.5rem)
- **sm**: 16px (1rem)
- **md**: 24px (1.5rem)
- **lg**: 32px (2rem)
- **xl**: 48px (3rem)

### Common Patterns
```css
/* Section spacing */
py-8 /* Vertical padding for sections */
px-4 /* Horizontal padding for mobile */
px-6 /* Horizontal padding for desktop */

/* Component spacing */
space-y-4 /* Vertical spacing between elements */
gap-4     /* Grid/flex gap */
mb-4      /* Bottom margin for headings */
```

## 🔄 Border Radius

```css
--radius-sm: 8px;    /* Small elements */
--radius-md: 12px;   /* Medium elements */
--radius-lg: 16px;   /* Cards, containers */
--radius-xl: 24px;   /* Large cards */
--radius-full: 9999px; /* Pills, badges, buttons */
```

### Tailwind Classes
- `rounded-lg` - 16px radius (cards)
- `rounded-2xl` - 24px radius (large cards)
- `rounded-full` - Full radius (buttons, badges)

## 🌑 Shadows

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
```

### Tailwind Classes
- `shadow-sm` - Subtle shadow
- `shadow-md` - Default shadow
- `shadow-lg` - Elevated shadow
- `shadow-xl` - High elevation

## 🎭 Component Examples

### Form Input
```html
<input 
  type="text" 
  class="w-full px-4 py-2.5 border border-[#e5e7eb] rounded-full 
         focus:outline-none focus:ring-2 focus:ring-[#ff630f] 
         focus:border-transparent transition-all"
  placeholder="Enter text..."
/>
```

### Select Dropdown
```html
<select class="w-full px-4 py-2.5 border border-[#e5e7eb] rounded-full 
               bg-white text-[#0b0707] focus:outline-none 
               focus:ring-2 focus:ring-[#ff630f]">
  <option>Option 1</option>
  <option>Option 2</option>
</select>
```

### Link Styles
```html
<a href="#" class="text-[#ff630f] hover:text-[#fe5b25] underline 
                   transition-colors duration-200">
  Link Text
</a>
```

### Table Styling
```html
<table class="w-full">
  <thead>
    <tr class="border-b border-[#e5e7eb]">
      <th class="text-left py-3 px-4 text-[#6b6a6a] font-medium text-sm">
        Header
      </th>
    </tr>
  </thead>
  <tbody>
    <tr class="border-b border-[#e5e7eb] hover:bg-[#faf9f6]">
      <td class="py-3 px-4 text-[#0b0707]">
        Cell Content
      </td>
    </tr>
  </tbody>
</table>
```

## 🎬 Animations & Transitions

### Default Transition
```css
transition-all duration-200
```

### Hover Scale
```css
transform hover:scale-105
```

### Color Transition
```css
transition-colors duration-200
```

### Shadow Transition
```css
transition-shadow duration-200
```

## 📱 Responsive Design

### Breakpoints
- **sm**: 640px
- **md**: 768px
- **lg**: 1024px
- **xl**: 1280px
- **2xl**: 1536px

### Mobile-First Approach
```html
<!-- Stack on mobile, grid on desktop -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- Content -->
</div>

<!-- Hide on mobile, show on desktop -->
<div class="hidden md:block">
  <!-- Desktop only content -->
</div>

<!-- Different padding for mobile/desktop -->
<div class="px-4 md:px-6 lg:px-8">
  <!-- Content -->
</div>
```

## 🔧 Utility Classes

### Text Utilities
```css
.text-storehub-primary { color: #0b0707; }
.text-storehub-secondary { color: #6b6a6a; }
.text-storehub-muted { color: #9ca3af; }
```

### Background Utilities
```css
.bg-storehub { background-color: #faf9f6; }
.bg-storehub-orange { background-color: #ff630f; }
```

### Border Utilities
```css
.border-storehub { border-color: #e5e7eb; }
```

## 💡 Usage Examples

### Page Layout
```html
<div class="min-h-screen bg-[#faf9f6]">
  <div class="max-w-6xl mx-auto px-4 py-8">
    <!-- Page content -->
  </div>
</div>
```

### Section Header
```html
<div class="mb-8">
  <h1 class="text-3xl font-bold text-[#0b0707]">Page Title</h1>
  <p class="text-[#6b6a6a] mt-2">Page description</p>
</div>
```

### Card Grid
```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <div class="bg-white rounded-2xl border border-[#e5e7eb] p-6">
    <!-- Card content -->
  </div>
</div>
```

### Action Bar
```html
<div class="flex justify-between items-center mb-6">
  <h2 class="text-xl font-semibold text-[#0b0707]">Section Title</h2>
  <div class="flex gap-2">
    <button class="btn-storehub-secondary">Cancel</button>
    <button class="btn-storehub-primary">Save</button>
  </div>
</div>
```

## 🎯 Key Design Principles

1. **Clean & Minimal**: Use plenty of whitespace
2. **Rounded Elements**: Prefer rounded corners (especially full radius for buttons)
3. **Subtle Shadows**: Use light shadows for depth
4. **Orange Accent**: Use StoreHub orange for primary actions
5. **Readable Typography**: Inter font with good line height
6. **Soft Background**: Off-white (#faf9f6) instead of pure white
7. **Smooth Transitions**: Add transitions for interactive elements
8. **Mobile-First**: Design for mobile, enhance for desktop

## 🚀 Quick Start

1. Import Inter font in your CSS:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
```

2. Set base styles:
```css
body {
  font-family: 'Inter', sans-serif;
  background-color: #faf9f6;
  color: #0b0707;
  line-height: 1.7;
}
```

3. Use the predefined classes for consistent styling across the application.

---

*This design system is based on StoreHub's brand guidelines and web design patterns.*