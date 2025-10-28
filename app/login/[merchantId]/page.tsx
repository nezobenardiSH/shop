import LoginForm from '@/components/LoginForm'
import { Metadata } from 'next'

// Static metadata - the page title will be updated client-side by LoginForm
export const metadata: Metadata = {
  title: 'Merchant Login - Onboarding Portal',
  description: 'Login to your onboarding portal'
}

export default async function LoginPage({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params
  return <LoginForm merchantId={merchantId} />
}