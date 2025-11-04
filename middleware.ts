import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// Ensure we have a proper JWT secret
const jwtSecretString = process.env.JWT_SECRET || 'development-secret-key-change-in-production'
if (!process.env.JWT_SECRET) {
  console.warn('[Middleware] WARNING: Using default JWT_SECRET. Set JWT_SECRET environment variable in production!')
}

const JWT_SECRET = new TextEncoder().encode(jwtSecretString)

async function verifyTokenEdge(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload
  } catch (error) {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Debug logging for production
  console.log('[Middleware] Processing path:', path)

  // Protect /admin routes (but not API routes)
  if (path.startsWith('/admin') && !path.includes('/api/')) {
    console.log('[Middleware] Protecting admin route:', path)
    const adminToken = request.cookies.get('admin-token')

    if (!adminToken) {
      console.log('[Middleware] No admin token found, showing login')
      // Admin page handles its own login UI, so just continue
      return NextResponse.next()
    }

    console.log('[Middleware] Found admin token, verifying...')
    const payload = await verifyTokenEdge(adminToken.value)

    if (!payload || !payload.isAdmin) {
      console.log('[Middleware] Admin token invalid or not admin')
      // Clear invalid admin token
      const response = NextResponse.next()
      response.cookies.delete('admin-token')
      return response
    }

    console.log('[Middleware] Admin token valid')
  }

  // Only protect /merchant/* routes (but not API routes)
  if (path.startsWith('/merchant/') && !path.includes('/api/')) {
    console.log('[Middleware] Protecting merchant route:', path)
    const token = request.cookies.get('auth-token')

    if (!token) {
      console.log('[Middleware] No auth token found, redirecting to login')
      // Preserve the original URL for redirect after login
      const merchantId = path.split('/')[2]
      const loginUrl = new URL(`/login/${merchantId}`, request.url)
      loginUrl.searchParams.set('redirect', path)
      return NextResponse.redirect(loginUrl)
    }

    console.log('[Middleware] Found auth token, verifying...')
    const payload = await verifyTokenEdge(token.value)

    if (!payload) {
      console.log('[Middleware] Token invalid or expired, redirecting to login')
      // Token is invalid or expired
      const merchantId = path.split('/')[2]
      const loginUrl = new URL(`/login/${merchantId}`, request.url)
      loginUrl.searchParams.set('redirect', path)
      loginUrl.searchParams.set('expired', 'true')

      // Clear the invalid token
      const response = NextResponse.redirect(loginUrl)
      response.cookies.delete('auth-token')
      return response
    }

    console.log('[Middleware] Token valid for merchant:', payload.trainerId)

    // Verify token matches the merchantId in URL
    // Salesforce IDs can be 15 or 18 characters - we need to handle both
    const urlMerchantId = path.split('/')[2]
    const tokenTrainerId = payload.trainerId as string

    // Compare the first 15 characters of both IDs (case-insensitive for the suffix)
    // Salesforce IDs: 15-char version is case-sensitive, 18-char adds 3-char case-safe suffix
    const urlId15 = urlMerchantId.substring(0, 15)
    const tokenId15 = tokenTrainerId.substring(0, 15)

    if (urlId15 !== tokenId15) {
      console.log('[Middleware] Token mismatch - URL ID:', urlMerchantId, '(15-char:', urlId15, ') Token ID:', tokenTrainerId, '(15-char:', tokenId15, ')')
      // Instead of blocking, redirect to login for the new merchant
      const loginUrl = new URL(`/login/${urlMerchantId}`, request.url)
      loginUrl.searchParams.set('redirect', path)

      // Clear the old token since it's for a different merchant
      const response = NextResponse.redirect(loginUrl)
      response.cookies.delete('auth-token')
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     * - public assets
     */
    '/merchant/:path*',
    '/admin/:path*',
    '/((?!api|_next/static|_next/image|favicon.ico|login|public).*)',
  ]
}