import { SignUp } from '@clerk/nextjs';
import logo from '@/assets/logo.png';

export default function SignUpPage() {
  return (
    <div className="from-background to-muted flex min-h-screen w-screen items-center justify-center bg-gradient-to-b">
      <div className="flex flex-col items-center space-y-6">
        <div className="flex justify-center">
          <img src={logo.src} alt="HeyFun Logo" className="h-24 w-auto" />
        </div>
        <SignUp forceRedirectUrl="/" signInUrl="/signin" />
      </div>
    </div>
  );
}
