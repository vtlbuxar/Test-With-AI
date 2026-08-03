"use client";

import { useAuth } from "@/lib/use-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Mail, Phone, Shield, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProfilePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="container mx-auto p-6 max-w-3xl flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
            <p className="text-muted-foreground">Manage your account details and preferences.</p>
          </div>
        </div>
        <Button variant="destructive" onClick={logout} className="gap-2">
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
      </div>

      <Card className="border-t-4 border-t-primary shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">{user.name}</CardTitle>
              <CardDescription className="text-base mt-1 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                  {user.role}
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Email Field */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Email Address
              </label>
              <p className="text-base font-medium">{user.email}</p>
            </div>

            {/* Phone Field */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Phone Number
              </label>
              <p className="text-base font-medium">{user.phoneNumber || "Not provided"}</p>
            </div>
            
            {/* Role Field */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Account Role
              </label>
              <p className="text-base font-medium capitalize">{user.role}</p>
            </div>

            {/* ID Field */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <User className="w-4 h-4" />
                Account ID
              </label>
              <p className="text-sm font-mono text-muted-foreground">{user.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
