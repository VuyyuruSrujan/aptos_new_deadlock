import { useState, useRef, useEffect, createContext, useContext } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Wallet,
  User,
  Shield,
  TestTube,
  Menu,
  X,
  Home,
  Moon,
  Sun,
  Copy,
  LogOut,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "crypto-inheritance-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};

const ThemeToggle = () => {
  const { theme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="relative h-9 w-9 transition-all duration-300 hover:bg-accent hover:text-accent-foreground"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
};

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { name: "Home", path: "/", icon: Home },
    { name: "Dashboard", path: "/dashboard", icon: Shield },
    { name: "Profile", path: "/profile", icon: User },
    { name: "Test Mode", path: "/test", icon: TestTube },
  ];

  // ✅ Connect using Aptos Wallet Standard only
  async function connectfun() {
    try {
      if (!window.aptos) {
        console.error("Aptos wallet not found");
        return;
      }
      
      const alreadyConnected = await window.aptos.isConnected();
      if (!alreadyConnected) {
        await window.aptos.connect();
      }
      const accountResponse = await window.aptos.account();
      setWalletAddress(accountResponse.address);
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  }

  async function disconnect() {
    try {
      if (window.aptos?.disconnect && typeof window.aptos.disconnect === 'function') {
        await window.aptos.disconnect();
      }
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    } finally {
      setWalletAddress("");
    }
  }

  async function copyAddress() {
    if (walletAddress) {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  const shortAddress = walletAddress
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : "";

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Restore wallet if already connected
  useEffect(() => {
    const saved = localStorage.getItem("walletAddress");
    if (saved) setWalletAddress(saved);

    // Listen for account change / disconnect events from Aptos wallet
    if (window.aptos) {
      window.aptos.onAccountChange?.((account: AptosAccount | null) => {
        setWalletAddress(account?.address || null);
        if (account?.address) {
          localStorage.setItem("walletAddress", account.address);
        } else {
          localStorage.removeItem("walletAddress");
        }
      });

      window.aptos.onDisconnect?.(() => {
        setWalletAddress(null);
        localStorage.removeItem("walletAddress");
      });
    }
  }, []);

  useEffect(() => {
    if (walletAddress) {
      localStorage.setItem("walletAddress", walletAddress);
    }
  }, [walletAddress]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50 shadow-xl transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <NavLink to="/" className="flex items-center space-x-2 select-none">
            <div className="w-9 h-9 bg-gradient-primary rounded-xl flex items-center justify-center shadow-md">
              <Shield className="w-5 h-5 text-white drop-shadow" />
            </div>
            <span className="font-extrabold text-2xl tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              DeadLock
            </span>
          </NavLink>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-3 py-2 rounded-lg transition-smooth ${isActive
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </div>

          {/* Theme Toggle & Wallet Connect */}
          <div className="hidden md:flex items-center gap-4">
            <ThemeToggle />
            <div className="relative" ref={dropdownRef}>
              {!walletAddress ? (
                <Button
                  variant="default"
                  className="bg-gradient-primary hover:opacity-90 shadow"
                  onClick={connectfun}
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
              ) : (
                <div>
                  <Button
                    variant="default"
                    className="bg-gradient-primary hover:opacity-90 shadow"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                  >
                    {shortAddress}
                  </Button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white/95 dark:bg-gray-900/95 shadow-xl border border-gray-200 dark:border-gray-700 backdrop-blur-md">
                      <button
                        onClick={copyAddress}
                        className="w-full flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 mr-2 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 mr-2" />
                        )}
                        {copied ? "Copied!" : "Copy Address"}
                      </button>
                      <button
                        onClick={disconnect}
                        className="w-full flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <LogOut className="w-4 h-4 mr-2 text-red-500" />
                        Disconnect
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden py-4 space-y-2 glass-card border border-border/50 shadow-xl"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-2 px-3 py-2 rounded-lg transition-smooth ${isActive
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`
                }
                onClick={() => setIsOpen(false)}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.name}</span>
              </NavLink>
            ))}

            <div className="pt-2">
              {!walletAddress ? (
                <Button
                  variant="default"
                  className="w-full bg-gradient-primary hover:opacity-90"
                  onClick={connectfun}
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
              ) : (
                <div className="w-full bg-white/95 dark:bg-gray-900/95 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 backdrop-blur-md">
                  <button
                    onClick={copyAddress}
                    className="w-full flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 mr-2 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    {copied ? "Copied!" : "Copy Address"}
                  </button>
                  <button
                    onClick={disconnect}
                    className="w-full flex items-center px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <LogOut className="w-4 h-4 mr-2 text-red-500" />
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
