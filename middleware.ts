export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/connecting/:path*',
    '/connect/:path*',
    '/inbox/:path*',
  ],
}
