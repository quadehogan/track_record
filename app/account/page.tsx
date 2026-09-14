import { auth } from "@clerk/nextjs/server";
import { UserProfile, SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default async function AccountPage() {
  const { userId } = await auth();

  if (!userId) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Account settings</CardTitle>
            <CardDescription>
              Sign in to manage or delete your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SignInButton>
              <Button>Sign in</Button>
            </SignInButton>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <UserProfile />
    </div>
  );
}
