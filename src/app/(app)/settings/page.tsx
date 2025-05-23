import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings as SettingsIcon, Palette, Bell, ShieldCheck } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl font-bold tracking-tight flex items-center">
            <SettingsIcon className="mr-3 h-8 w-8 text-primary" />
            Application Settings
          </CardTitle>
          <CardDescription>
            Customize your SocialSync experience. More settings coming soon!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-6 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold flex items-center mb-2">
              <Palette className="mr-2 h-6 w-6 text-accent" />
              Appearance
            </h3>
            <p className="text-muted-foreground">
              Theme and display options will be available here. (e.g., Dark Mode toggle, font size adjustments)
            </p>
          </div>

          <div className="p-6 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold flex items-center mb-2">
              <Bell className="mr-2 h-6 w-6 text-accent" />
              Notifications
            </h3>
            <p className="text-muted-foreground">
              Manage your notification preferences for different platforms and event types.
            </p>
          </div>

          <div className="p-6 border rounded-lg hover:shadow-md transition-shadow">
            <h3 className="text-xl font-semibold flex items-center mb-2">
              <ShieldCheck className="mr-2 h-6 w-6 text-accent" />
              Privacy & Security
            </h3>
            <p className="text-muted-foreground">
              Control data sharing settings and manage your account security.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
