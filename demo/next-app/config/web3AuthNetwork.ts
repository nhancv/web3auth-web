export const WEB3AUTH_NETWORK = {
  testnet: {
    displayName: "Testnet",
  },
  mainnet: {
    displayName: "Mainnet",
  },
  cyan: {
    displayName: "Cyan",
  },
} as const;

export type WEB3AUTH_NETWORK_TYPE = keyof typeof WEB3AUTH_NETWORK;
