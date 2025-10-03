import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'development-secret-key-change-in-production'
)

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
  
  // Only protect /merchant/* routes (but not API routes)
  if (path.startsWith('/merchant/') && !path.includes('/api/')) {
    const token = request.cookies.get('auth-token')
    
    if (!token) {
      // Preserve the original URL for redirect after login
      const merchantId = path.split('/')[2]
      const loginUrl = new URL(`/login/${merchantId}`, request.url)
      loginUrl.searchParams.set('redirect', path)
      return NextResponse.redirect(loginUrl)
    }
    
    const payload = await verifyTokenEdge(token.value)
    
    if (!payload) {
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
    
    // Verify token matches the merchantId in URL (case-insensitive comparison)
    const urlMerchantId = path.split('/')[2]
    const tokenMerchantId = payload.merchantId as string
    
    // Compare case-insensitively since URLs might have different cases
    if (urlMerchantId.toLowerCase() !== tokenMerchantId.toLowerCase()) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
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
     */
    '/((?!api|_next/static|_next/image|favicon.ico|login).*)',
  ]
}