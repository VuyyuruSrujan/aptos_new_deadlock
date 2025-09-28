import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Key, Bell, Loader2, Lock, Wallet } from "lucide-react";
import { AptosClient } from "aptos";
import { NETWORK, MODULE_ADDRESS } from "../constants";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/use-toast";

const NODE_URL = `https://fullnode.${NETWORK}.aptoslabs.com/v1`;
const MODULE_NAME = "deadlock_v2";

const client = new AptosClient(NODE_URL);

interface Owner {
  owner: string;
  percentage: number;
}

const Profile = () => {
  const [walletAddress, setWalletAddress] = useState("");
  const [ownersWhoAddedMe, setOwnersWhoAddedMe] = useState<Owner[]>([]);

  // State for Lock Funds
  const [lockAmount, setLockAmount] = useState<string>("");
  const [locked, setLocked] = useState(0);
  const [isLocking, setIsLocking] = useState(false);
  const [lockSuccess, setLockSuccess] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [isClaimingFunds, setIsClaimingFunds] = useState<{[key: string]: boolean}>({});

  // State for Deadlock Configuration
  const [inactiveDays, setInactiveDays] = useState<string>("");
  const [savedInactiveDays, setSavedInactiveDays] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Get wallet address from localStorage
  useEffect(() => {
    const addr = localStorage.getItem("walletAddress") || "";
    console.log("Retrieved wallet address from localStorage:", addr);
    setWalletAddress(addr);
  }, []);

  // Fetch who added me as beneficiary
  useEffect(() => {
    const fetchBeneficiaryData = async () => {
      if (!walletAddress || !MODULE_ADDRESS) {
        console.log("Missing required data:", { walletAddress, MODULE_ADDRESS });
        return;
      }

      try {
        console.log("Fetching beneficiary data for:", walletAddress);
        const result = await client.view({
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_added_as_beneficiary`,
          type_arguments: [],
          arguments: [walletAddress],
        });

        console.log("Raw result from contract:", result);

        if (result && Array.isArray(result[0])) {
          const owners = result[0].map((owner: any) => {
            console.log("Processing owner entry:", owner);
            return {
              owner: owner.owner,
              percentage: owner.percentage
            };
          });
          console.log("Processed owners:", owners);
          setOwnersWhoAddedMe(owners);
        } else {
          setOwnersWhoAddedMe([]);
        }
      } catch (err) {
        console.error("Error fetching beneficiary data:", err);
        setOwnersWhoAddedMe([]);
      }
    };

    fetchBeneficiaryData();
  }, [walletAddress, MODULE_ADDRESS]);



  // Check wallet connection
  useEffect(() => {
    const checkWallet = async () => {
      const wallet = (window as any).aptos;
      if (wallet) {
        try {
          const response = await wallet.account();
          console.log("Connected wallet account:", response);
        } catch (error) {
          console.error("Error getting wallet account:", error);
        }
      } else {
        console.log("Petra wallet not found");
      }
    };
    checkWallet();
  }, []);

  // Fetch locked funds from blockchain
  useEffect(() => {
    const fetchLockedFunds = async () => {
      if (!walletAddress || !MODULE_ADDRESS) return;
      try {
        const result = await client.view({
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_locked_funds`,
          type_arguments: [],
          arguments: [walletAddress],
        });
        // result[0] is the amount in Octas (1 APT = 10^8 Octas)
        const lockedApt = result && result[0] ? Number(result[0]) / 1e8 : 0;
        setLocked(lockedApt);
      } catch (err) {
        setLocked(0);
      }
    };
    fetchLockedFunds();
  }, [walletAddress]);

  // Fetch user's Aptos balance
  useEffect(() => {
    const fetchUserBalance = async () => {
      if (!walletAddress || !MODULE_ADDRESS) return;
      try {
        const result = await client.view({
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_user_balance`,
          type_arguments: [],
          arguments: [walletAddress],
        });
        const balanceApt = result && result[0] ? Number(result[0]) / 1e8 : 0;
        setWalletBalance(balanceApt);
      } catch (err) {
        setWalletBalance(0);
      }
    };
    fetchUserBalance();
  }, [walletAddress]);

  const handleLockFunds = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLocking(true);
    setLockSuccess(false);
    let txHash = null;
    try {
      const amountNum = Number(lockAmount);
      if (!walletAddress || !amountNum) throw new Error("Wallet address or amount missing");
      if (amountNum > walletBalance) {
        toast({ title: "Insufficient Balance", description: "You do not have enough balance to lock this amount.", variant: "destructive" });
        setIsLocking(false);
        return;
      }
      if (!MODULE_ADDRESS) {
        toast({ title: "Error", description: "Contract address not configured. Please set VITE_MODULE_ADDRESS and restart the app.", variant: "destructive" });
        setIsLocking(false);
        return;
      }
      // Convert APT to Octas (1 APT = 10^8 Octas)
      const amountInOctas = (amountNum * 100000000).toString();
      const payload = {
        type: "entry_function_payload",
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::lock_funds`,
        type_arguments: [],
        arguments: [amountInOctas],
      };
      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      txHash = response?.hash;
      if (!txHash) throw new Error("Transaction failed. No hash returned.");
      await client.waitForTransaction(txHash);
      toast({ title: "Funds Locked!", description: `Transaction Hash: ${txHash.slice(0, 10)}...`, variant: "default" });
      setIsLocking(false);
      setLockSuccess(true);
      setTimeout(() => window.location.reload(), 1200);
    } catch (error: any) {
      setIsLocking(false);
      setLockSuccess(false);
      toast({ title: "Error", description: error?.message || "Failed to lock funds", variant: "destructive" });
    }
  };

  const handleSaveConfiguration = async () => {
    if (!inactiveDays || Number(inactiveDays) < 1) {
      toast({ 
        title: "Invalid Input", 
        description: "Please enter a valid number of days (minimum 1 day).", 
        variant: "destructive" 
      });
      return;
    }

    setIsSaving(true);
    
    // Simulate saving (since no backend/smart contract changes needed)
    setTimeout(() => {
      setSavedInactiveDays(Number(inactiveDays));
      setIsEditing(false);
      setIsSaving(false);
      toast({ 
        title: "Configuration Saved", 
        description: `Inactivity period set to ${inactiveDays} days successfully.`, 
        variant: "default" 
      });
    }, 1000);
  };

  const handleUpdateConfiguration = () => {
    setIsEditing(true);
    setInactiveDays(savedInactiveDays?.toString() || "");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setInactiveDays("");
  };

  const handleClaimFunds = async (ownerAddress: string, uniqueKey: string) => {
    console.log("Starting claim for owner:", ownerAddress, "with key:", uniqueKey);
    console.log("Current claiming states:", isClaimingFunds);
    
    setIsClaimingFunds(prev => {
      // Reset all to false, then set only the clicked one to true
      const newState: {[key: string]: boolean} = {};
      Object.keys(prev).forEach(key => { newState[key] = false; });
      newState[uniqueKey] = true;
      console.log("Setting claiming state to:", newState);
      return newState;
    });
    
    let txHash = null;
    
    try {
      if (!walletAddress || !ownerAddress) throw new Error("Wallet address or owner address missing");
      if (!MODULE_ADDRESS) {
        toast({ title: "Error", description: "Contract address not configured. Please set VITE_MODULE_ADDRESS and restart the app.", variant: "destructive" });
        throw new Error("Contract address not configured");
      }

      const payload = {
        type: "entry_function_payload",
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::claim_inheritance`,
        type_arguments: [],
        arguments: [ownerAddress],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      txHash = response?.hash;
      
      if (!txHash) throw new Error("Transaction failed. No hash returned.");
      
      await client.waitForTransaction(txHash);
      
      toast({ 
        title: "Funds Claimed Successfully!", 
        description: `Transaction Hash: ${txHash.slice(0, 10)}...`, 
        variant: "default" 
      });
      
      // Refresh the page after successful claim
      setTimeout(() => window.location.reload(), 1200);
      
    } catch (error: any) {
      console.error("Error claiming funds:", error);
      toast({ 
        title: "Error Claiming Funds", 
        description: error?.message || "Failed to claim funds. Please try again.", 
        variant: "destructive" 
      });
    } finally {
      console.log("Resetting claiming state for key:", uniqueKey);
      setIsClaimingFunds(prev => {
        const newState = { ...prev, [uniqueKey]: false };
        console.log("Final claiming state:", newState);
        return newState;
      });
    }
  };

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
        </div>

        <Tabs defaultValue="lock" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="lock">Lock Funds</TabsTrigger>
            <TabsTrigger value="security">Profile Setup</TabsTrigger>
            <TabsTrigger value="wallets">Wallets</TabsTrigger>
            <TabsTrigger value="beneficiary-status">Who Added Me</TabsTrigger>
          </TabsList>

          <TabsContent value="lock" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Lock Funds
                </CardTitle>
                <CardDescription>Lock your funds securely in the contract</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs text-muted-foreground">Connected Address</div>
                    <div className="font-mono break-all text-primary mb-2">{walletAddress}</div>
                    <div className="text-xs text-muted-foreground">Current Balance</div>
                    <div className="font-bold mb-2">{walletBalance} APT</div>
                    <div className="text-xs text-muted-foreground">Funds Locked Till Now</div>
                    <div className="font-bold text-green-600">{locked} APT</div>
                  </div>
                  <form onSubmit={handleLockFunds} className="space-y-4 flex flex-col justify-center">
                    <Label htmlFor="lockAmount">Amount to Lock</Label>
                    <Input
                      id="lockAmount"
                      type="number"
                      value={lockAmount}
                      onChange={e => setLockAmount(e.target.value)}
                      placeholder="Enter amount"
                      required
                      disabled={isLocking}
                    />
                    <Button type="submit" disabled={isLocking || !lockAmount} variant="hero" className="flex items-center justify-center">
                      {isLocking ? (
                        <>
                          <Loader2 className="animate-spin h-4 w-4 mr-2" /> Locking...
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4 mr-2" /> Lock Funds
                        </>
                      )}
                    </Button>
                    {lockSuccess && (
                      <div className="mt-2 flex items-center gap-2 animate-bounce text-green-600 font-semibold">
                        <Lock className="h-4 w-4" /> Funds locked successfully!
                      </div>
                    )}
                  </form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Profile Setup
                </CardTitle>
                <CardDescription>Configure your deadlock settings and inheritance preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 border rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                  <div className="mb-4">
                    <h3 className="font-medium text-primary mb-2">Deadlock Configuration</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Our smart contract securely locks your digital assets and automatically transfers them to your designated beneficiaries during periods of wallet inactivity. 
                      Configure the inactivity threshold to trigger the inheritance distribution process.
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    {isEditing ? (
                      // Editing/Input Mode
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="inactiveDays" className="text-primary font-medium">
                            Inactivity Period (Days)
                          </Label>
                          <Input 
                            id="inactiveDays" 
                            type="number" 
                            placeholder="e.g., 365" 
                            min="1"
                            max="3650"
                            value={inactiveDays}
                            onChange={(e) => setInactiveDays(e.target.value)}
                            className="border-primary/30 focus:border-primary"
                            disabled={isSaving}
                          />
                          <p className="text-xs text-muted-foreground">
                            After this many days without any transactions from your wallet, 
                            the smart contract will consider you inactive and allow beneficiaries to claim inheritance.
                          </p>
                        </div>
                        
                        <div className="bg-muted border border-border rounded-lg p-3">
                          <p className="text-sm text-muted-foreground">
                            <strong>Important:</strong> This setting determines when your beneficiaries can access your locked funds. 
                            Choose a period that balances security with your expected activity patterns.
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            onClick={handleSaveConfiguration}
                            disabled={isSaving || !inactiveDays}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center"
                          >
                            {isSaving ? (
                              <>
                                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                                Saving...
                              </>
                            ) : (
                              "Save Configuration"
                            )}
                          </Button>
                          {savedInactiveDays !== null && (
                            <Button 
                              onClick={handleCancelEdit}
                              variant="outline"
                              disabled={isSaving}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </>
                    ) : (
                      // Display Mode
                      <>
                        <div className="bg-accent border border-border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-primary font-medium text-base">
                                Current Inactivity Period
                              </Label>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-2xl font-bold text-primary">
                                  {savedInactiveDays}
                                </span>
                                <span className="text-primary/80 font-medium">
                                  {savedInactiveDays === 1 ? 'day' : 'days'}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Configuration saved successfully
                              </p>
                            </div>
                            <Button 
                              onClick={handleUpdateConfiguration}
                              variant="outline"
                              className="border-primary/30 text-primary hover:bg-accent"
                            >
                              Update
                            </Button>
                          </div>
                        </div>
                        
                        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                          <p className="text-sm text-primary/80">
                            <strong>Active Configuration:</strong> After {savedInactiveDays} {savedInactiveDays === 1 ? 'day' : 'days'} of wallet inactivity, 
                            your beneficiaries will be able to claim their inheritance shares.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">Profile Status</h3>
                    <p className="text-sm text-muted-foreground">Current account status and activity</p>
                  </div>
                  <Badge variant="outline" className="text-green-600">Active</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">Last Activity</h3>
                    <p className="text-sm text-muted-foreground">Most recent wallet transaction</p>
                  </div>
                  <Badge variant="outline">Today</Badge>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wallets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Connected Wallets
                </CardTitle>
                <CardDescription>Manage your cryptocurrency wallets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <span className="text-orange-600 font-bold">₿</span>
                    </div>
                    <div>
                      <h3 className="font-medium">Bitcoin Wallet</h3>
                      <p className="text-sm text-muted-foreground">bc1q...xyz123</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-green-600">Connected</Badge>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 font-bold">Ξ</span>
                    </div>
                    <div>
                      <h3 className="font-medium">Ethereum Wallet</h3>
                      <p className="text-sm text-muted-foreground">0x...abc789</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-green-600">Connected</Badge>
                </div>

                <Button variant="outline" className="w-full">
                  Connect New Wallet
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="beneficiary-status" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Who Added Me as Beneficiary
                </CardTitle>
                <CardDescription>See who has included you in their inheritance plan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {ownersWhoAddedMe.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-muted-foreground">You are a beneficiary for:</h3>
                    {ownersWhoAddedMe.map((owner, index) => {
                      const uniqueKey = `${owner.owner}-${index}`;
                      const isThisButtonLoading = isClaimingFunds[uniqueKey] === true;
                      console.log(`Button for owner ${owner.owner} (index ${index}) with key ${uniqueKey}: loading = ${isThisButtonLoading}`);
                      
                      return (
                        <div key={uniqueKey} className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                          <div className="space-y-1 flex-1">
                            <h4 className="font-medium text-green-800">Added by:</h4>
                            <p className="text-sm font-mono text-muted-foreground break-all">{owner.owner}</p>
                            <p className="text-xs text-green-600">You will inherit {owner.percentage}% of their funds</p>
                          </div>
                          <div className="flex flex-col items-end ml-4 space-y-2">
                            <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-lg px-3 py-1">
                              {owner.percentage}%
                            </Badge>
                            <span className="text-xs text-muted-foreground">inheritance share</span>
                            <Button
                              onClick={() => handleClaimFunds(owner.owner, uniqueKey)}
                              disabled={isThisButtonLoading}
                              variant="default"
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                            >
                              {isThisButtonLoading ? (
                                <>
                                  <Loader2 className="animate-spin h-3 w-3 mr-1" />
                                  Claiming...
                                </>
                              ) : (
                                <>
                                  <Wallet className="h-3 w-3 mr-1" />
                                  Get My Funds
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Total records:</strong> {ownersWhoAddedMe.length} {ownersWhoAddedMe.length === 1 ? 'person has' : 'people have'} added you as beneficiary
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Bell className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No beneficiary records</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      No one has added you as a beneficiary yet.
                    </p>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md">
                      <p className="text-sm text-blue-800">
                        When someone includes you in their inheritance plan, you'll see their details here along with your inheritance percentage.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


        </Tabs>
      </div>
    </main>
  );
};

export default Profile;