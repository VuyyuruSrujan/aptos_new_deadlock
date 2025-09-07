declare global {
  interface AptosAccount {
    address: string;
    publicKey?: string;
  }

  interface AptosWallet {
    connect(): Promise<AptosAccount>;
    disconnect?(): Promise<void>;
    isConnected(): Promise<boolean>;
    account(): Promise<AptosAccount>;
    onAccountChange?: (callback: (account: AptosAccount | null) => void) => void;
    onDisconnect?: (callback: () => void) => void;
  }

  interface Window {
    aptos?: AptosWallet;
  }
}

export {};
