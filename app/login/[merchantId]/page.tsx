import LoginForm from '@/components/LoginForm'

export default async function LoginPage({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params
  return <LoginForm merchantId={merchantId} />
}