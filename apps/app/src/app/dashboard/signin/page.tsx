import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return <SignIn forceRedirectUrl="/" signUpUrl="/signup" />;
}
