import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return <SignIn forceRedirectUrl="/dashboard" signUpUrl="/signup" />;
}
