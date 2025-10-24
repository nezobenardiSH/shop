import Image from 'next/image'

export default function MerchantPage() {
  return (
    <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* StoreHub Logo */}
        <div className="mb-6">
          <Image
            src="/SH_logo.avif"
            alt="StoreHub Logo"
            width={200}
            height={50}
            className="mx-auto"
            priority
          />
        </div>

        {/* Message */}
        <p className="text-base md:text-lg text-[#0b0707] leading-relaxed">
          Navigate to your personalized onboarding link to access your onboarding dashboard. Contact your onboarding manager to get the link.
        </p>
      </div>
    </div>
  )
}

