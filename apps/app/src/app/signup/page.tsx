import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return <SignUp forceRedirectUrl="/" signInUrl="/signin" />;
}
