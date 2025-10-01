import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Bell, Loader2, Wallet, Plus, Send, Copy, Clock } from "lucide-react";
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
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [locked, setLocked] = useState(0);
  const [isLocking, setIsLocking] = useState(false);
  const [lockSuccess, setLockSuccess] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [isClaimingFunds, setIsClaimingFunds] = useState<{[key: string]: boolean}>({});
  const [deadlockStatuses, setDeadlockStatuses] = useState<{[key: string]: {
    deadlockTriggered: boolean;
    timeSinceLastActivity: number;
    requiredInactivityPeriod: number;
    lastActivityTimestamp: number;
    claimed: boolean;
  }}>({});

  // State for Deadlock Configuration
  const [inactiveDays, setInactiveDays] = useState<string>("");
  const [savedInactiveDays, setSavedInactiveDays] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // State for Subaccount Management
  const [hasSubaccount, setHasSubaccount] = useState(false);
  const [isCreatingSubaccount, setIsCreatingSubaccount] = useState(false);
  const [subaccountAddress, setSubaccountAddress] = useState("");
  const [subaccountBalance, setSubaccountBalance] = useState(0);
  const [subaccountCreatedAt, setSubaccountCreatedAt] = useState(0);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferToAddress, setTransferToAddress] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

    // Get wallet address from localStorage
  useEffect(() => {
    const storedAddress = localStorage.getItem("walletAddress");
    if (storedAddress) {
      setWalletAddress(storedAddress);
      checkSubaccountExists(storedAddress);
    }
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

  // Fetch existing deadlock configuration
  const fetchDeadlockConfig = async () => {
    if (!walletAddress || !MODULE_ADDRESS) return;
    try {
      console.log("Fetching deadlock config for:", walletAddress);
      const result = await client.view({
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_deadlock_config_precise`,
        type_arguments: [],
        arguments: [walletAddress],
      });
      
      console.log("Deadlock config result:", result);
      
      if (result && result[1] && Number(result[1]) > 0) {
        const seconds = Number(result[1]);
        const days = seconds / 86400; // Convert seconds back to days (with decimals)
        // Keep more precision - round to 6 decimal places to handle very small values
        const preciseDays = Math.round(days * 1000000) / 1000000; 
        console.log("Found existing config:", preciseDays, "days (", seconds, "seconds)");
        setSavedInactiveDays(preciseDays);
        setIsEditing(false); // Show display mode if config exists
      } else {
        console.log("No existing config found, showing input mode");
        setIsEditing(true); // Show input mode if no config exists
      }
    } catch (err) {
      console.error("Error fetching deadlock config:", err);
      setIsEditing(true); // Default to input mode on error
    }
  };

  useEffect(() => {
    fetchDeadlockConfig();
  }, [walletAddress]);

  // Check for existing subaccount
  useEffect(() => {
    checkSubaccountExists();
  }, [walletAddress]);

  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      
      // Check if user has completed profile setup (deadlock configuration) from smart contract
      try {
        const configResult = await client.view({
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::has_deadlock_config`,
          type_arguments: [],
          arguments: [walletAddress],
        });
        
        const hasConfig = configResult && configResult[0] === true;
        
        if (!hasConfig) {
          toast({ 
            title: "Profile Setup Required", 
            description: "Please complete your Profile Setup first to set the inactivity period before locking funds.", 
            variant: "destructive" 
          });
          setIsLocking(false);
          // Switch to Profile Setup tab
          const profileSetupTab = document.querySelector('[value="security"]');
          if (profileSetupTab) {
            (profileSetupTab as HTMLElement).click();
          }
          return;
        }
      } catch (configError) {
        console.error("Error checking deadlock config:", configError);
        toast({ 
          title: "Profile Setup Required", 
          description: "Please complete your Profile Setup first to set the inactivity period before locking funds.", 
          variant: "destructive" 
        });
        setIsLocking(false);
        // Switch to Profile Setup tab
        const profileSetupTab = document.querySelector('[value="security"]');
        if (profileSetupTab) {
          (profileSetupTab as HTMLElement).click();
        }
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

  const handleDepositToSubaccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLocking(true);
    setLockSuccess(false);
    
    try {
      const amountNum = Number(lockAmount);
      if (!walletAddress || !amountNum) throw new Error("Wallet address or amount missing");
      
      if (amountNum > walletBalance) {
        toast({ 
          title: "Insufficient Balance", 
          description: "You do not have enough balance to deposit this amount.", 
          variant: "destructive" 
        });
        setIsLocking(false);
        return;
      }

      if (!hasSubaccount) {
        toast({ 
          title: "Subaccount Required", 
          description: "Please create a subaccount first before depositing funds.", 
          variant: "destructive" 
        });
        setIsLocking(false);
        return;
      }

      if (!MODULE_ADDRESS) {
        toast({ 
          title: "Error", 
          description: "Contract address not configured. Please set VITE_MODULE_ADDRESS and restart the app.", 
          variant: "destructive" 
        });
        setIsLocking(false);
        return;
      }

      // Convert APT to Octas (1 APT = 10^8 Octas)
      const amountInOctas = (amountNum * 100000000).toString();
      
      const payload = {
        type: "entry_function_payload",
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::deposit_to_subaccount`,
        type_arguments: [],
        arguments: [amountInOctas],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      const txHash = response?.hash;
      
      if (!txHash) throw new Error("Transaction failed. No hash returned.");
      
      await client.waitForTransaction(txHash);
      
      // Refresh subaccount balance
      await fetchSubaccountDetails();
      
      // Clear the input field
      setLockAmount("");
      
      toast({ 
        title: "Funds Deposited!", 
        description: `${amountNum} APT deposited to subaccount. TX: ${txHash.slice(0, 10)}...`, 
        variant: "default" 
      });
      
      setLockSuccess(true);
      
    } catch (error: any) {
      toast({ 
        title: "Deposit Failed", 
        description: error?.message || "Failed to deposit funds to subaccount", 
        variant: "destructive" 
      });
    } finally {
      setIsLocking(false);
    }
  };

  const handleSaveConfiguration = async () => {
    const daysValue = parseFloat(inactiveDays);
    if (!inactiveDays || isNaN(daysValue) || daysValue <= 0) {
      toast({ 
        title: "Invalid Input", 
        description: "Please enter a valid number of days (must be greater than 0).", 
        variant: "destructive" 
      });
      return;
    }

    setIsSaving(true);
    let txHash = null;
    
    try {
      if (!walletAddress) throw new Error("Wallet address not found");
      if (!MODULE_ADDRESS) {
        toast({ title: "Error", description: "Contract address not configured. Please set VITE_MODULE_ADDRESS and restart the app.", variant: "destructive" });
        setIsSaving(false);
        return;
      }

      // Convert decimal days to seconds for precise storage
      const totalSeconds = Math.round(daysValue * 86400); // 86400 seconds per day, round to nearest second
      
      const payload = {
        type: "entry_function_payload",
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::set_deadlock_config_seconds`,
        type_arguments: [],
        arguments: [totalSeconds.toString()],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      txHash = response?.hash;
      
      if (!txHash) throw new Error("Transaction failed. No hash returned.");
      
      await client.waitForTransaction(txHash);
      
      // Refresh configuration from blockchain to ensure accuracy
      await fetchDeadlockConfig();
      
      setIsSaving(false);
      toast({ 
        title: "Configuration Saved", 
        description: `Inactivity period set to ${daysValue} days successfully. TX: ${txHash.slice(0, 10)}...`, 
        variant: "default" 
      });
      
    } catch (error: any) {
      setIsSaving(false);
      toast({ 
        title: "Error Saving Configuration", 
        description: error?.message || "Failed to save configuration. Please try again.", 
        variant: "destructive" 
      });
    }
  };

  const handleUpdateConfiguration = () => {
    setIsEditing(true);
    setInactiveDays(savedInactiveDays?.toString() || "");
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setInactiveDays("");
  };

    // Subaccount Management Functions
  const checkSubaccountExists = async (address?: string) => {
    const addr = address || walletAddress;
    console.log("Checking subaccount for address:", addr);
    if (!addr || !MODULE_ADDRESS) {
      console.log("Missing address or module address:", { addr, MODULE_ADDRESS });
      return;
    }
    
    try {
      console.log("Calling has_subaccount view function...");
      const result = await client.view({
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::has_subaccount`,
        type_arguments: [],
        arguments: [addr],
      });
      
      console.log("has_subaccount result:", result);
      
      if (result && result[0] === true) {
        console.log("Subaccount exists, fetching details...");
        setHasSubaccount(true);
        await fetchSubaccountDetails(addr);
      } else {
        console.log("No subaccount found");
        setHasSubaccount(false);
      }
    } catch (error) {
      console.error("Error checking subaccount:", error);
      setHasSubaccount(false);
    }
  };

  const fetchSubaccountDetails = async (address?: string) => {
    const addr = address || walletAddress;
    console.log("Fetching subaccount details for address:", addr);
    if (!addr || !MODULE_ADDRESS) return;
    
    try {
      console.log("Calling get_subaccount_details view function...");
      const result = await client.view({
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_subaccount_details`,
        type_arguments: [],
        arguments: [addr],
      });
      
      console.log("get_subaccount_details result:", result);
      
      if (result && result.length >= 3) {
        const subaccountAddr = result[0] as string;
        const balance = result[1] ? Number(result[1]) / 1e8 : 0; // Convert from Octas to APT
        const createdAt = result[2] ? Number(result[2]) : 0;
        
        console.log("Setting subaccount data:", {
          address: subaccountAddr,
          balance,
          createdAt
        });
        
        setSubaccountAddress(subaccountAddr);
        setSubaccountBalance(balance);
        setSubaccountCreatedAt(createdAt);
      } else {
        console.log("Invalid or empty result from get_subaccount_details");
      }
    } catch (error) {
      console.error("Error fetching subaccount details:", error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ 
        title: "Copied!", 
        description: "Address copied to clipboard", 
        variant: "default" 
      });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to copy to clipboard", 
        variant: "destructive" 
      });
    }
  };

  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const formatAddress = (address: string) => {
    if (!address) return "";
    return address.length > 20 
      ? `${address.slice(0, 10)}...${address.slice(-6)}`
      : address;
  };

  const handleCreateSubaccount = async () => {
    if (!walletAddress) {
      toast({ title: "Error", description: "Wallet address not found", variant: "destructive" });
      return;
    }

    if (!MODULE_ADDRESS) {
      toast({ title: "Error", description: "Contract address not configured", variant: "destructive" });
      return;
    }

    setIsCreatingSubaccount(true);
    
    try {
      const payload = {
        type: "entry_function_payload",
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::create_subaccount`,
        type_arguments: [],
        arguments: [],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      const txHash = response?.hash;
      
      if (!txHash) throw new Error("Transaction failed. No hash returned.");
      
      await client.waitForTransaction(txHash);
      
      console.log("Subaccount creation transaction completed, refreshing data...");
      
      // Refresh subaccount data
      await checkSubaccountExists();
      
      toast({ 
        title: "Subaccount Created!", 
        description: `Subaccount created successfully. TX: ${txHash.slice(0, 10)}...`, 
        variant: "default" 
      });
      
    } catch (error: any) {
      toast({ 
        title: "Error Creating Subaccount", 
        description: error?.message || "Failed to create subaccount", 
        variant: "destructive" 
      });
    } finally {
      setIsCreatingSubaccount(false);
    }
  };

  const handleTransferFromSubaccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!transferToAddress || !transferAmount) {
      toast({ title: "Error", description: "Please fill in all transfer details", variant: "destructive" });
      return;
    }

    if (!MODULE_ADDRESS) {
      toast({ title: "Error", description: "Contract address not configured", variant: "destructive" });
      return;
    }

    const amount = parseFloat(transferAmount);
    if (amount <= 0 || amount > subaccountBalance) {
      toast({ title: "Error", description: "Invalid transfer amount", variant: "destructive" });
      return;
    }

    setIsTransferring(true);

    try {
      // Convert APT to Octas (1 APT = 10^8 Octas)
      const amountInOctas = (amount * 100000000).toString();
      
      const payload = {
        type: "entry_function_payload",
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::transfer_from_subaccount`,
        type_arguments: [],
        arguments: [transferToAddress, amountInOctas],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      const txHash = response?.hash;
      
      if (!txHash) throw new Error("Transaction failed. No hash returned.");
      
      await client.waitForTransaction(txHash);
      
      // Refresh subaccount details
      await fetchSubaccountDetails();
      
      setTransferAmount("");
      setTransferToAddress("");
      
      toast({ 
        title: "Transfer Successful!", 
        description: `${amount} APT transferred to ${transferToAddress}. TX: ${txHash.slice(0, 10)}...`, 
        variant: "default" 
      });
      
    } catch (error: any) {
      toast({ 
        title: "Transfer Failed", 
        description: error?.message || "Failed to transfer funds", 
        variant: "destructive" 
      });
    } finally {
      setIsTransferring(false);
    }
  };

  // Check deadlock status for all owners
  const checkAllDeadlockStatuses = async () => {
    if (!MODULE_ADDRESS || ownersWhoAddedMe.length === 0) return;
    
    const statuses: {[key: string]: any} = {};
    
    for (const owner of ownersWhoAddedMe) {
      try {
        // Check deadlock status
        const deadlockResult = await client.view({
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::check_deadlock_status`,
          type_arguments: [],
          arguments: [owner.owner],
        });

        // Get beneficiary details to check if already claimed
        const beneficiaryDetails = await client.view({
          function: `${MODULE_ADDRESS}::${MODULE_NAME}::get_added_as_beneficiary`,
          type_arguments: [],
          arguments: [walletAddress],
        });

        let claimed = false;
        if (beneficiaryDetails && Array.isArray(beneficiaryDetails[0])) {
          const ownerEntries = beneficiaryDetails[0];
          const ownerEntry = ownerEntries.find((entry: any) => entry.owner === owner.owner);
          if (ownerEntry) {
            claimed = ownerEntry.claimed;
          }
        }
        
        if (deadlockResult && deadlockResult.length >= 4) {
          statuses[owner.owner] = {
            deadlockTriggered: deadlockResult[0] as boolean,
            timeSinceLastActivity: Number(deadlockResult[1]),
            requiredInactivityPeriod: Number(deadlockResult[2]),
            lastActivityTimestamp: Number(deadlockResult[3]),
            claimed: claimed,
          };
        }
      } catch (error) {
        console.error(`Error checking deadlock status for ${owner.owner}:`, error);
        // Set default values on error
        statuses[owner.owner] = {
          deadlockTriggered: false,
          timeSinceLastActivity: 0,
          requiredInactivityPeriod: 0,
          lastActivityTimestamp: 0,
          claimed: false,
        };
      }
    }
    
    setDeadlockStatuses(statuses);
  };

  // Check deadlock statuses when owners list changes
  useEffect(() => {
    if (ownersWhoAddedMe.length > 0) {
      checkAllDeadlockStatuses();
    }
  }, [ownersWhoAddedMe, MODULE_ADDRESS, walletAddress]);

  const handleClaimFunds = async (ownerAddress: string, uniqueKey: string) => {
    console.log("Starting claim for owner:", ownerAddress, "with key:", uniqueKey);
    
    setIsClaimingFunds(prev => {
      // Reset all to false, then set only the clicked one to true
      const newState: {[key: string]: boolean} = {};
      Object.keys(prev).forEach(key => { newState[key] = false; });
      newState[uniqueKey] = true;
      return newState;
    });
    
    try {
      if (!walletAddress || !ownerAddress) throw new Error("Wallet address or owner address missing");
      if (!MODULE_ADDRESS) {
        toast({ title: "Error", description: "Contract address not configured", variant: "destructive" });
        throw new Error("Contract address not configured");
      }

      // First, check deadlock status
      console.log("Checking deadlock status for owner:", ownerAddress);
      const deadlockResult = await client.view({
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::check_deadlock_status`,
        type_arguments: [],
        arguments: [ownerAddress],
      });

      console.log("Deadlock status result:", deadlockResult);
      
      if (deadlockResult && deadlockResult.length >= 4) {
        const deadlockTriggered = deadlockResult[0] as boolean;
        const timeSinceLastActivity = Number(deadlockResult[1]);
        const requiredInactivityPeriod = Number(deadlockResult[2]);
        const lastActivityTimestamp = Number(deadlockResult[3]);
        
        if (!deadlockTriggered) {
          const remainingTime = requiredInactivityPeriod - timeSinceLastActivity;
          const remainingDays = Math.ceil(remainingTime / 86400); // Convert seconds to days
          const lastActivityDate = new Date(lastActivityTimestamp * 1000).toLocaleString();
          
          toast({ 
            title: "Deadlock Period Not Reached", 
            description: `Owner was last active on ${lastActivityDate}. You can claim funds after ${remainingDays} more day(s) of inactivity.`, 
            variant: "destructive",
            duration: 8000
          });
          
          setIsClaimingFunds(prev => ({ ...prev, [uniqueKey]: false }));
          return;
        }
      }

      // If deadlock is triggered, proceed with claiming
      console.log("Deadlock triggered, proceeding with claim...");
      
      const payload = {
        type: "entry_function_payload",
        function: `${MODULE_ADDRESS}::${MODULE_NAME}::claim_deadlock_funds`,
        type_arguments: [],
        arguments: [ownerAddress],
      };

      const response = await (window as any).aptos.signAndSubmitTransaction(payload);
      const txHash = response?.hash;
      
      if (!txHash) throw new Error("Transaction failed. No hash returned.");
      
      await client.waitForTransaction(txHash);
      
      toast({ 
        title: "Deadlock Funds Claimed!", 
        description: `Funds successfully transferred to your subaccount. TX: ${txHash.slice(0, 10)}...`, 
        variant: "default" 
      });
      
      // Refresh subaccount balance and deadlock statuses
      await checkSubaccountExists();
      await checkAllDeadlockStatuses();
      
      // Don't reload the page, just show success message
      console.log("Claim successful, statuses refreshed");
      
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

        <Tabs defaultValue="subaccount" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="subaccount">Create Subaccount</TabsTrigger>
            <TabsTrigger value="security">Profile Setup</TabsTrigger>
            <TabsTrigger value="lock">Deposit Funds</TabsTrigger>
            <TabsTrigger value="beneficiary-status">Who Added Me</TabsTrigger>
          </TabsList>

          <TabsContent value="lock" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Deposit to Subaccount
                </CardTitle>
                <CardDescription>Transfer funds from your main wallet to your subaccount</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-xs text-muted-foreground">Connected Address</div>
                    <div className="font-mono break-all text-primary mb-2">{walletAddress}</div>
                    <div className="text-xs text-muted-foreground">Current Balance</div>
                    <div className="font-bold mb-2">
                      {walletBalance} APT 
                      <span className="text-sm text-muted-foreground ml-2">
                        (~${(walletBalance * 4.23).toFixed(2)} USD)
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">Subaccount Balance</div>
                    <div className="font-bold text-blue-600">
                      {subaccountBalance} APT
                      <span className="text-sm text-muted-foreground ml-2">
                        (~${(subaccountBalance * 4.23).toFixed(2)} USD)
                      </span>
                    </div>
                  </div>
                  <form onSubmit={handleDepositToSubaccount} className="space-y-4 flex flex-col justify-center">
                    <Label htmlFor="depositAmount">Amount to Deposit</Label>
                    <Input
                      id="depositAmount"
                      type="number"
                      step="0.00000001"
                      max={walletBalance}
                      value={lockAmount}
                      onChange={e => setLockAmount(e.target.value)}
                      placeholder="Enter amount to deposit"
                      required
                      disabled={isLocking || !hasSubaccount}
                    />
                    {!hasSubaccount && (
                      <p className="text-sm text-amber-600">
                        ⚠️ Please create a subaccount first before depositing funds.
                      </p>
                    )}
                    <Button type="submit" disabled={isLocking || !lockAmount || !hasSubaccount} className="bg-blue-600 hover:bg-blue-700 flex items-center justify-center">
                      {isLocking ? (
                        <>
                          <Loader2 className="animate-spin h-4 w-4 mr-2" /> Depositing...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" /> Deposit to Subaccount
                        </>
                      )}
                    </Button>
                    {lockSuccess && (
                      <div className="mt-2 flex items-center gap-2 animate-bounce text-blue-600 font-semibold">
                        <Send className="h-4 w-4" /> Funds deposited successfully!
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
                            step="any"
                            placeholder="e.g., 30 , 60 , 90 ,365" 
                            min="0.000001"
                            max="3650"
                            value={inactiveDays}
                            onChange={(e) => setInactiveDays(e.target.value)}
                            className="border-primary/30 focus:border-primary"
                            disabled={isSaving}
                          />
                          <p className="text-xs text-muted-foreground">
                            After this many days (supports high precision decimals like 0.000694 days ≈ 1 minute) without any transactions from your wallet, 
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

          <TabsContent value="subaccount" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  Subaccount Management
                </CardTitle>
                <CardDescription>
                  Create and manage your deadlock subaccount for secure fund management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!hasSubaccount ? (
                  // Show create subaccount section
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                      <Plus className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">Create Your Subaccount</h3>
                    <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                      Create a unique subaccount linked to your wallet address for managing your deadlock funds securely.
                    </p>
                    <Button 
                      onClick={handleCreateSubaccount}
                      disabled={isCreatingSubaccount}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {isCreatingSubaccount ? (
                        <>
                          <Loader2 className="animate-spin h-4 w-4 mr-2" />
                          Creating Subaccount...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Create Subaccount
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  // Show subaccount details and transfer options
                  <div className="space-y-6">
                    {/* Subaccount Details */}
                    <div className="p-6 border rounded-lg bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-green-200 dark:border-green-800">
                      <h3 className="font-semibold text-green-800 dark:text-green-300 mb-4 flex items-center gap-2">
                        <Wallet className="h-5 w-5" />
                        Your Subaccount Details
                      </h3>
                      
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm text-muted-foreground">Subaccount Address</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="flex-1 p-3 bg-gray-100 dark:bg-gray-800 border rounded text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                              {subaccountAddress}
                            </code>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(subaccountAddress)}
                              className="shrink-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="p-3 bg-white/50 dark:bg-gray-900/50 rounded-lg border">
                          <Label className="text-sm text-muted-foreground">Available Funds</Label>
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                            {subaccountBalance} APT
                          </div>
                        </div>

                        {subaccountCreatedAt > 0 && (
                          <div className="text-xs text-muted-foreground">
                            Created on: {new Date(subaccountCreatedAt * 1000).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Transfer Funds Section */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <Send className="h-5 w-5" />
                          Transfer Funds from Subaccount
                        </CardTitle>
                        <CardDescription>
                          Transfer your funds from the subaccount to any address
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleTransferFromSubaccount} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="transferToAddress">To Address</Label>
                            <Input
                              id="transferToAddress"
                              type="text"
                              placeholder="Enter recipient address"
                              value={transferToAddress}
                              onChange={(e) => setTransferToAddress(e.target.value)}
                              disabled={isTransferring}
                              required
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="transferAmount">Amount (APT)</Label>
                            <Input
                              id="transferAmount"
                              type="number"
                              step="0.00000001"
                              max={subaccountBalance}
                              placeholder="Enter amount to transfer"
                              value={transferAmount}
                              onChange={(e) => setTransferAmount(e.target.value)}
                              disabled={isTransferring}
                              required
                            />
                            <p className="text-xs text-muted-foreground">
                              Available: {subaccountBalance} APT
                            </p>
                          </div>
                          
                          <Button 
                            type="submit"
                            disabled={isTransferring || !transferToAddress || !transferAmount || subaccountBalance === 0}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                          >
                            {isTransferring ? (
                              <>
                                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                                Transferring...
                              </>
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-2" />
                                Send Funds
                              </>
                            )}
                          </Button>
                        </form>
                      </CardContent>
                    </Card>

                    {/* Information Card */}
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Note:</strong> This subaccount is uniquely generated for your wallet address. 
                        You can use it to manage your deadlock funds and transfer them back to your main wallet or any other address when needed.
                      </p>
                    </div>
                  </div>
                )}
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
                      const status = deadlockStatuses[owner.owner];
                      
                      const formatTimeRemaining = (seconds: number) => {
                        const days = Math.ceil(seconds / 86400);
                        const hours = Math.ceil((seconds % 86400) / 3600);
                        if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
                        return `${hours} hour${hours > 1 ? 's' : ''}`;
                      };
                      
                      return (
                        <div key={uniqueKey} className="border rounded-lg overflow-hidden">
                          <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2 flex-1">
                                <h4 className="font-medium text-green-800">Added by:</h4>
                                <p className="text-sm font-mono text-muted-foreground break-all">{owner.owner}</p>
                                <div className="flex items-center gap-4">
                                  <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                                    {owner.percentage}% inheritance
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Status Section */}
                          <div className="p-4 bg-white border-t">
                            {status ? (
                              <div className="space-y-3">
                                {status.claimed ? (
                                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                      <span className="text-sm font-medium text-green-800">
                                        ✅ Funds Received
                                      </span>
                                    </div>
                                    <p className="text-xs text-green-600 mt-1">
                                      You have successfully received your {owner.percentage}% inheritance from this owner.
                                    </p>
                                  </div>
                                ) : status.deadlockTriggered ? (
                                  <div className="space-y-3">
                                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                        <span className="text-sm font-medium text-blue-800">
                                          🔓 Funds Available for Claiming
                                        </span>
                                      </div>
                                      <p className="text-xs text-blue-600 mt-1">
                                        The deadlock period has passed. You can now claim your inheritance.
                                      </p>
                                    </div>
                                    <Button
                                      onClick={() => handleClaimFunds(owner.owner, uniqueKey)}
                                      disabled={isThisButtonLoading}
                                      className="w-full bg-blue-600 hover:bg-blue-700"
                                    >
                                      {isThisButtonLoading ? (
                                        <>
                                          <Loader2 className="animate-spin h-4 w-4 mr-2" />
                                          Claiming Funds...
                                        </>
                                      ) : (
                                        <>
                                          <Wallet className="h-4 w-4 mr-2" />
                                          Claim My {owner.percentage}% Inheritance
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                      <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                                        <span className="text-sm font-medium text-amber-800">
                                          ⏳ Waiting for Deadlock Period
                                        </span>
                                      </div>
                                      <div className="text-xs text-amber-700 mt-2 space-y-1">
                                        <p><strong>Owner's Configuration:</strong> {Math.ceil(status.requiredInactivityPeriod / 86400)} day(s) inactivity period</p>
                                        <p><strong>Last Activity:</strong> {new Date(status.lastActivityTimestamp * 1000).toLocaleString()}</p>
                                        <p><strong>Time Remaining:</strong> {formatTimeRemaining(status.requiredInactivityPeriod - status.timeSinceLastActivity)}</p>
                                      </div>
                                    </div>
                                    <Button
                                      disabled={true}
                                      variant="outline"
                                      className="w-full"
                                    >
                                      <Clock className="h-4 w-4 mr-2" />
                                      Funds Not Yet Available
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Loader2 className="animate-spin h-4 w-4" />
                                  <span className="text-sm text-gray-600">Checking status...</span>
                                </div>
                              </div>
                            )}
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