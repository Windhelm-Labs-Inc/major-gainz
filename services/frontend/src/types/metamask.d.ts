declare module '@metamask/detect-provider' {
  interface DetectProviderOptions {
    mustBeMetaMask?: boolean
    silent?: boolean
  }

  const detectEthereumProvider: (
    options?: DetectProviderOptions
  ) => Promise<any | null>

  export default detectEthereumProvider
} 