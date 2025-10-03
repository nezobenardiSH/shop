// StoreHub Design System
export const storehubTheme = {
  colors: {
    // Primary colors
    primary: '#ff630f', // StoreHub orange
    primaryHover: '#fe5b25',
    primaryLight: '#fff4ed',
    
    // Background colors
    bgPrimary: '#faf9f6', // Off-white background
    bgWhite: '#ffffff',
    bgGray: '#f8f8f8',
    
    // Text colors
    textPrimary: '#0b0707', // Deep black
    textSecondary: '#6b6a6a', // Gray
    textMuted: '#9ca3af',
    textWhite: '#ffffff',
    
    // Status colors
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6',
    
    // Border colors
    borderLight: '#e5e7eb',
    borderMedium: '#d1d5db',
  },
  
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    sizes: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    weights: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: '1.7',
  },
  
  spacing: {
    xs: '0.5rem',   // 8px
    sm: '1rem',     // 16px
    md: '1.5rem',   // 24px
    lg: '2rem',     // 32px
    xl: '3rem',     // 48px
  },
  
  borderRadius: {
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    full: '9999px',
  },
  
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
}

// Tailwind classes for StoreHub styling
export const storehubStyles = {
  // Buttons
  button: {
    primary: 'bg-[#ff630f] hover:bg-[#fe5b25] text-white font-medium rounded-full px-6 py-2.5 transition-all duration-200 transform hover:scale-105',
    secondary: 'bg-white hover:bg-gray-50 text-[#0b0707] font-medium rounded-full px-6 py-2.5 border border-[#e5e7eb] transition-all duration-200',
    ghost: 'hover:bg-gray-100 text-[#6b6a6a] font-medium rounded-full px-4 py-2 transition-all duration-200',
  },
  
  // Cards
  card: {
    base: 'bg-white rounded-2xl border border-[#e5e7eb] p-6',
    hover: 'bg-white rounded-2xl border border-[#e5e7eb] p-6 hover:shadow-lg transition-shadow duration-200',
  },
  
  // Text
  text: {
    heading: 'text-[#0b0707] font-semibold',
    body: 'text-[#0b0707] font-normal',
    secondary: 'text-[#6b6a6a]',
    muted: 'text-[#9ca3af]',
  },
  
  // Badges
  badge: {
    success: 'bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium',
    warning: 'bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium',
    error: 'bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-medium',
    info: 'bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium',
    default: 'bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium',
  },
}