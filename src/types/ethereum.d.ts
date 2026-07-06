// EVM wallet provider types: window.ethereum + EIP-6963 multi-wallet discovery
export {};

// EIP-1193 provider interface (common to all EVM wallets)
interface EIP1193Provider {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  on: (event: string, listener: (...args: any[]) => void) => void;
  removeListener: (event: string, listener: (...args: any[]) => void) => void;
  removeAllListeners: () => void;
  isMetaMask?: boolean;
  isTrust?: boolean;
  isCoinbaseWallet?: boolean;
  isRabby?: boolean;
  selectedAddress?: string;
}

// EIP-6963: Multi-wallet discovery standard
interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string; // data URI (image/svg+xml or image/png)
  rdns: string; // reverse domain notation, e.g. "io.metamask"
}

interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  provider: EIP1193Provider;
}

interface EIP6963AnnounceProviderEvent extends CustomEvent {
  detail: EIP6963ProviderDetail;
}

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }

  interface WindowEventMap {
    "eip6963:announceProvider": EIP6963AnnounceProviderEvent;
  }
}
