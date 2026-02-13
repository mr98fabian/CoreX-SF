import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Shield, Cog, Bell, User, Flame, Lock } from "lucide-react";
import { useState } from "react";

export default function SettingsPage() {
    const [emergencyFund, setEmergencyFund] = useState([3000]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">System Configuration</h1>
                <p className="text-slate-400">Manage your profile, algorithm parameters, and notification preferences.</p>
            </div>

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="grid w-full grid-cols-3 md:w-[400px]">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="algorithm">Algorithm</TabsTrigger>
                    <TabsTrigger value="notifications">Notifications</TabsTrigger>
                </TabsList>

                {/* TAB 1: GENERAL */}
                <TabsContent value="general" className="space-y-4 mt-6">
                    <Card className="border-slate-800 bg-slate-950/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <User className="h-5 w-5 text-slate-400" /> Profile Information
                            </CardTitle>
                            <CardDescription>Update your personal details.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name" className="text-slate-300">Display Name</Label>
                                <Input id="name" defaultValue="Fabian" className="bg-slate-900 border-slate-700 text-white" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="email" className="text-slate-300">Email Address</Label>
                                <Input id="email" defaultValue="fabian@corex.com" className="bg-slate-900 border-slate-700 text-white" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-800 bg-slate-950/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Shield className="h-5 w-5 text-emerald-500" /> Security
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-slate-200">Two-Factor Authentication</Label>
                                    <p className="text-xs text-slate-500">Secure your account with 2FA.</p>
                                </div>
                                <Switch />
                            </div>
                            <Separator className="bg-zinc-800" />
                            <Button variant="outline" className="text-slate-300 border-slate-700 hover:bg-slate-800 hover:text-white">
                                <Lock className="mr-2 h-4 w-4" /> Change Password
                            </Button>
                        </CardContent>
                        <CardFooter>
                            <Button className="ml-auto bg-blue-600 hover:bg-blue-700">Save General Settings</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                {/* TAB 2: ALGORITHM STRATEGY */}
                <TabsContent value="algorithm" className="space-y-4 mt-6">
                    <Card className="border-slate-800 bg-slate-950/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Cog className="h-5 w-5 text-blue-500" /> The Brain
                            </CardTitle>
                            <CardDescription>Fine-tune the Velocity Banking algorithm.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            {/* STRATEGY MODE */}
                            <div className="space-y-3">
                                <Label className="text-slate-200">Strategy Mode</Label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="rounded-lg border-2 border-slate-700 bg-slate-900 p-4 hover:bg-slate-800 cursor-pointer transition-colors relative">
                                        <div className="font-semibold text-white">Balanced</div>
                                        <div className="text-xs text-slate-500">Optimal mix of savings and debt payoff. Recommended.</div>
                                    </div>
                                    <div className="rounded-lg border-2 border-blue-600 bg-blue-950/20 p-4 relative cursor-pointer">
                                        <div className="absolute top-2 right-2">
                                            <Flame className="h-4 w-4 text-orange-500" />
                                        </div>
                                        <div className="font-semibold text-blue-100">Aggressive Velocity</div>
                                        <div className="text-xs text-blue-300/70">Maximizes cashflow speed. Higher risk tolerance.</div>
                                    </div>
                                </div>
                            </div>

                            <Separator className="bg-zinc-800" />

                            {/* EMERGENCY FUND */}
                            <div className="space-y-4">
                                <div className="flex justify-between">
                                    <Label className="text-slate-200">Emergency Fund Protection Floor</Label>
                                    <span className="font-mono text-emerald-400 font-bold">${emergencyFund[0].toLocaleString()}</span>
                                </div>
                                <Slider
                                    defaultValue={[3000]}
                                    max={20000}
                                    step={100}
                                    className="py-2"
                                    onValueChange={setEmergencyFund}
                                />
                                <p className="text-xs text-slate-500">The amount of cash liquidity the algorithm will NEVER touch.</p>
                            </div>

                            <Separator className="bg-zinc-800" />

                            <div className="grid gap-2">
                                <Label htmlFor="frequency" className="text-slate-300">Paycheck Frequency</Label>
                                <select id="frequency" className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-sm shadow-sm transition-colors text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-300">
                                    <option>Weekly</option>
                                    <option>Bi-Weekly</option>
                                    <option>Monthly</option>
                                </select>
                            </div>

                        </CardContent>
                        <CardFooter>
                            <Button className="ml-auto bg-blue-600 hover:bg-blue-700">Update Algorithm</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>

                {/* TAB 3: NOTIFICATIONS */}
                <TabsContent value="notifications" className="space-y-4 mt-6">
                    <Card className="border-slate-800 bg-slate-950/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white">
                                <Bell className="h-5 w-5 text-yellow-500" /> Notification Preferences
                            </CardTitle>
                            <CardDescription>Choose what alerts you want to receive.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-slate-200">Payment Due Alerts</Label>
                                    <p className="text-xs text-slate-500">Receive alerts 3 days before any due date.</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <Separator className="bg-zinc-800" />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-slate-200">Daily Strategy Summary</Label>
                                    <p className="text-xs text-slate-500">Morning briefing of your financial velocity.</p>
                                </div>
                                <Switch />
                            </div>
                            <Separator className="bg-zinc-800" />
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label className="text-base text-rose-200">Bank Disconnect Alerts</Label>
                                    <p className="text-xs text-slate-500">Critical alert if Plaid loses connection.</p>
                                </div>
                                <Switch defaultChecked />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="ml-auto bg-blue-600 hover:bg-blue-700">Save Preferences</Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
