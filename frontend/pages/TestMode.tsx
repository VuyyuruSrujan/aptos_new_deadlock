import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Pause, AlertTriangle, CheckCircle, Clock, Zap } from "lucide-react";

const TestMode = () => {
  return (
    <main className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Test Mode</h1>
            <Badge variant="outline" className="text-orange-600 border-orange-600">
              <Zap className="h-3 w-3 mr-1" />
              Simulation
            </Badge>
          </div>
          <p className="text-muted-foreground">Test your inheritance plans in a safe environment</p>
        </div>

        <Alert className="mb-6 border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800">
            You are in test mode. No real transactions will be executed. All operations are simulated.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="scenarios" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="scenarios">Test Scenarios</TabsTrigger>
            <TabsTrigger value="simulations">Active Simulations</TabsTrigger>
            <TabsTrigger value="results">Test Results</TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Time Lock Simulation
                    <Badge variant="secondary">Quick Test</Badge>
                  </CardTitle>
                  <CardDescription>
                    Test inheritance plan activation after specified time periods
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Simulation Duration</span>
                      <Badge variant="outline">5 minutes</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Test Assets</span>
                      <span className="text-sm font-medium">$1,000 (Mock)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Beneficiaries</span>
                      <span className="text-sm font-medium">2 Test Accounts</span>
                    </div>
                  </div>
                  <Button className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Start Time Lock Test
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Multi-Signature Test
                    <Badge variant="secondary">Advanced</Badge>
                  </CardTitle>
                  <CardDescription>
                    Simulate multi-signature wallet inheritance scenarios
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Required Signatures</span>
                      <Badge variant="outline">2 of 3</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Test Network</span>
                      <span className="text-sm font-medium">Testnet</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Complexity</span>
                      <span className="text-sm font-medium">High</span>
                    </div>
                  </div>
                  <Button className="w-full" variant="outline">
                    <Play className="h-4 w-4 mr-2" />
                    Start MultiSig Test
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Emergency Access
                    <Badge variant="destructive">Critical</Badge>
                  </CardTitle>
                  <CardDescription>
                    Test emergency access scenarios and recovery procedures
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Access Type</span>
                      <Badge variant="outline">Emergency</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Recovery Time</span>
                      <span className="text-sm font-medium">24 hours</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Verification</span>
                      <span className="text-sm font-medium">2FA + Legal</span>
                    </div>
                  </div>
                  <Button className="w-full" variant="destructive">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Test Emergency Access
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Full Integration Test
                    <Badge variant="secondary">Complete</Badge>
                  </CardTitle>
                  <CardDescription>
                    Comprehensive test of entire inheritance workflow
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Test Duration</span>
                      <Badge variant="outline">30 minutes</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Scenarios</span>
                      <span className="text-sm font-medium">All Types</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Complexity</span>
                      <span className="text-sm font-medium">Maximum</span>
                    </div>
                  </div>
                  <Button className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Run Full Test Suite
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="simulations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Currently Running Simulations</CardTitle>
                <CardDescription>Monitor active test scenarios in real-time</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">Time Lock Simulation #001</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-blue-600">Running</Badge>
                      <Button size="sm" variant="outline">
                        <Pause className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>3/5 minutes</span>
                    </div>
                    <Progress value={60} />
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>2 minutes remaining</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">Multi-Signature Test #007</h3>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-green-600">Completed</Badge>
                      <Button size="sm" variant="outline">
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Status</span>
                      <span className="text-green-600">✓ All tests passed</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Completion Time</span>
                      <span>12:34 PM</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Test Results Summary</CardTitle>
                <CardDescription>Review completed test scenarios and their outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">12</div>
                    <div className="text-sm text-muted-foreground">Tests Passed</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-red-600">2</div>
                    <div className="text-sm text-muted-foreground">Tests Failed</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">3</div>
                    <div className="text-sm text-muted-foreground">Tests Running</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="font-medium">Time Lock Test #045</div>
                        <div className="text-sm text-muted-foreground">Completed 2 hours ago</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-green-600">Passed</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <div>
                        <div className="font-medium">Emergency Access #012</div>
                        <div className="text-sm text-muted-foreground">Failed 1 day ago</div>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-red-600">Failed</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
};

export default TestMode;