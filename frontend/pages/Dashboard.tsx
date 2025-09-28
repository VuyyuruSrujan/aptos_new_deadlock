

import { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { AptosClient } from "aptos";
import { NETWORK, MODULE_ADDRESS } from "../constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2 } from "lucide-react";

type Beneficiary = {
  addr: string;
  percentage: number;
};

const Dashboard = () => {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [form, setForm] = useState({ address: "", percentage: "" });
  // const [alert, setAlert] = useState<{ type: "add" | "update"; show: boolean }>({ type: "add", show: false });
  const [wallet, setWallet] = useState({
    address: '',
    totalLocked: 0,
    lastInteracted: '',
    lastLocked: '',
    available: 0,
    balance: 0,
    locked: 0,
  });

  const NODE_URL = `https://fullnode.${NETWORK}.aptoslabs.com/v1`;
  const MODULE_NAME = "deadlock_v2";
  const client = new AptosClient(NODE_URL);

  // Initialize global index if needed (only contract deployer can do this)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const initializeGlobalIndex = async () => {
    try {
      if (!(window as any).aptos) throw new Error("Wallet not connected");
      if (!MODULE_ADDRESS) throw new Error("Contract address not configured");

      const payload = {
        type: "entry_function_payload",
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::initialize_global_index`,
        type_arguments: [],
        arguments: [],
      };
      
      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      if (!response?.hash) throw new Error("Transaction failed");
      await client.waitForTransaction(response.hash);
      
      toast({ 
        title: "Global Index Initialized", 
        description: `Transaction Hash: ${response.hash.slice(0, 10)}...` 
      });
    } catch (err: any) {
      // It's okay if this fails - it might already be initialized or user might not be the deployer
      console.log("Global index initialization:", err?.message);
    }
  };

  // Get wallet address from localStorage (set by Navigation)
  useEffect(() => {
    const addr = localStorage.getItem('walletAddress') || '';
    setWallet((w) => ({ ...w, address: addr }));
  }, []);

  // Fetch locked funds and balance from blockchain
  useEffect(() => {
    const fetchWalletData = async () => {
      if (!wallet.address || !MODULE_ADDRESS) return;
      try {
        // Locked funds
        const lockedResult = await client.view({
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_locked_funds`,
          type_arguments: [],
          arguments: [wallet.address],
        });
        const lockedApt = lockedResult && lockedResult[0] ? Number(lockedResult[0]) / 1e8 : 0;
        // Balance
        const balanceResult = await client.view({
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_user_balance`,
          type_arguments: [],
          arguments: [wallet.address],
        });
        const balanceApt = balanceResult && balanceResult[0] ? Number(balanceResult[0]) / 1e8 : 0;
        setWallet((w) => ({
          ...w,
          totalLocked: lockedApt,
          locked: lockedApt,
          balance: balanceApt,
          available: balanceApt, // available is now always the current balance
        }));
      } catch (err) {
        setWallet((w) => ({ ...w, totalLocked: 0, locked: 0, balance: 0, available: 0 }));
      }
    };
    fetchWalletData();
  }, [wallet.address]);

  // Function to refresh beneficiaries from chain
  const refreshBeneficiaries = async () => {
    if (!wallet.address || !MODULE_ADDRESS) return;
    setLoadingBeneficiaries(true);
    try {
      const result = await client.view({
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_beneficiaries`,
        type_arguments: [],
        arguments: [wallet.address],
      });
      // result[0] is vector<Beneficiary> with { addr, percentage }
      setBeneficiaries(result.length > 0 ? result[0] as Beneficiary[] : []);
    } catch (err) {
      setBeneficiaries([]);
    }
    setLoadingBeneficiaries(false);
  };

  // Fetch on-chain beneficiaries for this user
  useEffect(() => {
    refreshBeneficiaries();
  }, [wallet.address]);

  const handleOpenForm = (index: number | null = null) => {
    setEditIndex(index);
    if (index !== null) {
      setForm({
        address: beneficiaries[index].addr,
        percentage: beneficiaries[index].percentage.toString(),
      });
    } else {
      setForm({ address: "", percentage: "" });
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditIndex(null);
    setForm({ address: "", percentage: "" });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const checkPercentage = async (addr: string, percentage: number): Promise<boolean> => {
    try {
      const result = await client.view({
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::check_beneficiary_percentage`,
        type_arguments: [],
        arguments: [wallet.address, addr, percentage],
      });
      return result[0] as boolean;
    } catch (error) {
      console.error("Error checking percentage:", error);
      return false;
    }
  };

  // Check if beneficiary already exists
  const checkBeneficiaryExists = async (beneficiaryAddr: string): Promise<boolean> => {
    try {
      const result = await client.view({
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::beneficiary_exists`,
        type_arguments: [],
        arguments: [wallet.address, beneficiaryAddr],
      });
      return result[0] as boolean;
    } catch (error) {
      console.error("Error checking beneficiary existence:", error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address || !form.percentage) return;
    try {
      if (!(window as any).aptos) throw new Error("Wallet not connected");
      if (!MODULE_ADDRESS) throw new Error("Contract address not configured");

      let payload;
      let toastMsg;
      
      if (editIndex !== null) {
        // Update existing beneficiary
        // Validate that we're updating the correct beneficiary
        if (editIndex >= beneficiaries.length || beneficiaries[editIndex].addr !== form.address) {
          toast({
            variant: "destructive",
            title: "Validation Error",
            description: "Beneficiary data is out of sync. Please refresh the page and try again.",
          });
          return;
        }
        
        // Check if the percentage would exceed 100%
        const wouldExceed = await checkPercentage(form.address, Number(form.percentage));
        if (wouldExceed) {
          toast({
            variant: "destructive",
            title: "Percentage Error",
            description: "Total beneficiary percentages would exceed 100%. Please adjust the percentage.",
          });
          return;
        }

        payload = {
          type: "entry_function_payload",
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::update_beneficiary`,
          type_arguments: [],
          arguments: [form.address, Number(form.percentage)],
        };
        toastMsg = "Beneficiary Updated!";
      } else {
        // Add new beneficiary - check for duplicates first
        const alreadyExists = await checkBeneficiaryExists(form.address);
        if (alreadyExists) {
          toast({
            variant: "destructive",
            title: "Duplicate Beneficiary",
            description: "This beneficiary already exists, you can update it from below.",
          });
          return;
        }

        // Check if the percentage would exceed 100%
        const wouldExceed = await checkPercentage(form.address, Number(form.percentage));
        if (wouldExceed) {
          toast({
            variant: "destructive",
            title: "Percentage Error",
            description: "Total beneficiary percentages would exceed 100%. Please adjust the percentage.",
          });
          return;
        }

        payload = {
          type: "entry_function_payload",
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::add_beneficiary`,
          type_arguments: [],
          arguments: [form.address, Number(form.percentage)],
        };
        toastMsg = "Beneficiary Added!";
      }
      
      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      if (!response?.hash) throw new Error("Transaction failed");
      await client.waitForTransaction(response.hash);
      
      toast({ title: toastMsg, description: `Transaction Hash: ${response.hash.slice(0, 10)}...` });
      
      // Small delay to ensure transaction is fully processed before refreshing
      setTimeout(async () => {
        await refreshBeneficiaries();
      }, 1000);
      
      handleCloseForm();
    } catch (err: any) {
      // Handle specific error codes from smart contract
      let errorMessage = err?.message || "Failed to add/update beneficiary";
      
      // Check if the error contains the EDUPLICATE_BENEFICIARY abort code
      if (err?.message?.includes("EDUPLICATE_BENEFICIARY") || err?.message?.includes("4")) {
        errorMessage = "This beneficiary already exists, you can update it from below.";
      }
      // Check if the error contains the EBENEFICIARY_NOT_FOUND abort code
      else if (err?.message?.includes("EBENEFICIARY_NOT_FOUND") || err?.message?.includes("5")) {
        errorMessage = "Beneficiary not found. Please refresh the page and try again.";
      }
      // Check if the error contains the EOVER_PERCENTAGE abort code
      else if (err?.message?.includes("EOVER_PERCENTAGE") || err?.message?.includes("3")) {
        errorMessage = "Total beneficiary percentages would exceed 100%. Please adjust the percentage.";
      }
      
      toast({ 
        title: "Error", 
        description: errorMessage, 
        variant: "destructive" 
      });
    }
  };

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="container mx-auto max-w-3xl">
        {/* Wallet Details */}
        <Card className="mb-8 neon-border">
          <CardHeader>
            <CardTitle>Wallet Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="font-semibold text-primary">Address:</div>
                <div className="break-all text-sm">{wallet.address || 'Not connected'}</div>
              </div>
              <div className="grid grid-cols-2 gap-4 md:gap-8 mt-4 md:mt-0">
                <div>
                  <div className="text-xs text-muted-foreground">Current Balance</div>
                  <div className="font-bold">{wallet.balance} APT</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Funds Locked Till Now</div>
                  <div className="font-bold text-green-600">{wallet.locked} APT</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Assigned (%)</div>
                  <div className="font-bold">{beneficiaries.reduce((sum, b) => sum + b.percentage, 0)}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Available</div>
                  <div className="font-bold">{wallet.available > 0 ? wallet.available.toFixed(2) + ' APT' : '0 APT'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Last Interacted</div>
                  <div className="font-bold">{wallet.lastInteracted || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Last Locked</div>
                  <div className="font-bold">{wallet.lastLocked || '-'}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button size="sm" variant="hero" onClick={() => handleOpenForm()}>
            <Plus className="h-4 w-4 mr-2" /> Add New Beneficiary
          </Button>
        </div>

        {/* Alert */}
        {/* {alert.show && (
          <div className="mb-6 animate-bounce">
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl border-2 border-dashed ${alert.type === "add" ? "border-[#00eaff] bg-[#00eaff22] text-[#00eaff]" : "border-[#ff4ecd] bg-[#ff4ecd22] text-[#ff4ecd]"}`}>
              <CheckCircle2 className="w-5 h-5" />
              {alert.type === "add" ? "Beneficiary added!" : "Beneficiary updated!"}
            </div>
          </div>
        )} */}

        {/* Beneficiary Form */}
        {showForm && (
          <Card className="mb-8 neon-border animate-fade-in">
            <CardHeader>
              <CardTitle>{editIndex !== null ? "Update Beneficiary" : "Add New Beneficiary"}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block mb-1 font-medium">Beneficiary Address</label>
                  <input
                    type="text"
                    name="address"
                    value={form.address}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block mb-1 font-medium">Percentage</label>
                  {/* Wallet Details */}
                  <Card className="mb-8 neon-border">
                    <CardHeader>
                      <CardTitle>Wallet Details</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                          <div className="font-semibold text-primary">Address:</div>
                          <div className="break-all text-sm">{wallet.address || 'Not connected'}</div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 md:gap-8 mt-4 md:mt-0">
                          <div>
                            <div className="text-xs text-muted-foreground">Total Locked</div>
                            <div className="font-bold">{wallet.totalLocked} APT</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Assigned (%)</div>
                            <div className="font-bold">{beneficiaries.reduce((sum, b) => sum + b.percentage, 0)}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Available</div>
                            <div className="font-bold">{wallet.available.toFixed(2)} APT</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Last Interacted</div>
                            <div className="font-bold">{wallet.lastInteracted || '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Last Locked</div>
                            <div className="font-bold">{wallet.lastLocked || '-'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Can Still Lock</div>
                            <div className="font-bold">{wallet.available > 0 ? wallet.available.toFixed(2) + ' APT' : '0 APT'}</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <input
                    type="number"
                    name="percentage"
                    value={form.percentage}
                    onChange={handleChange}
                    min={1}
                    max={100}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <div className="flex gap-4">
                  <Button type="submit" variant="hero">
                    {editIndex !== null ? "Update" : "Add"}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleCloseForm}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Beneficiary List */}
        <Card className="neon-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Beneficiaries</CardTitle>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                Total Allocated: <span className="font-semibold text-primary">{beneficiaries.reduce((sum, b) => sum + b.percentage, 0)}%</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshBeneficiaries}
                disabled={loadingBeneficiaries}
                className="h-8 px-3"
              >
                {loadingBeneficiaries ? "Refreshing..." : "Refresh"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {loadingBeneficiaries ? (
              <div className="text-muted-foreground text-center py-8">Loading beneficiaries...</div>
            ) : beneficiaries.length === 0 ? (
              <div className="text-muted-foreground text-center py-8">No beneficiaries added yet.</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {beneficiaries.map((b, i) => (
                  <div
                    key={i}
                    className="group relative flex flex-col rounded-xl border-2 border-primary/40 bg-gradient-to-br from-[#0f2027] via-[#2c5364] to-[#232526] shadow-xl overflow-hidden hover:border-primary/60 hover:shadow-2xl transition-all duration-300"
                    style={{ minHeight: "220px" }}
                  >
                    {/* Background Effects */}
                    <div className="absolute -top-8 -right-8 opacity-10 text-[10rem] pointer-events-none select-none rotate-12 transform group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300">
                      💎
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                    {/* Content */}
                    <div className="relative flex flex-col h-full p-8">
                      {/* Beneficiary Number */}
                      <div className="text-sm mb-6">
                        <div className="text-white/50">Beneficiary</div>
                        <div className="text-primary font-semibold">#{i + 1}</div>
                      </div>

                      {/* Percentage and Edit Button */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex flex-col items-center justify-center rounded-2xl bg-primary/20 p-4 text-primary shadow-lg backdrop-blur-sm border border-primary/30">
                          <span className="text-4xl font-bold leading-none">{b.percentage}%</span>
                          <span className="text-sm mt-1 opacity-70">allocated</span>
                        </div>

                        {/* Edit Button */}
                        <Button
                          variant="secondary"
                          size="lg"
                          onClick={() => {
                            setEditIndex(i);
                            setForm({ address: b.addr, percentage: b.percentage.toString() });
                            setShowForm(true);
                          }}
                          className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 hover:border-primary rounded-xl px-6 shadow-lg backdrop-blur-sm transition-all duration-300 font-medium"
                        >
                          <Edit2 className="h-5 w-5 mr-2" />
                          <span>Edit</span>
                        </Button>
                      </div>

                      {/* Address Section */}
                      <div className="flex-1 border-t border-white/10 pt-6">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="text-sm font-medium text-white/60 uppercase tracking-wider">Wallet Address</div>
                          <div className="flex-1 border-b border-dashed border-white/10"></div>
                        </div>
                        <div className="font-mono text-base text-white/90 break-all leading-relaxed bg-white/5 p-4 rounded-lg">
                          {b.addr}
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                          <span className="text-white/50 text-sm">Active</span>
                        </div>
                        <span className="text-primary/70 text-sm">Click button to edit</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Dashboard;