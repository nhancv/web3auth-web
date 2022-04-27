import WalletConnect from "@walletconnect/client";
import {
  ADAPTER_CATEGORY,
  ADAPTER_CATEGORY_TYPE,
  ADAPTER_EVENTS,
  ADAPTER_NAMESPACES,
  ADAPTER_STATUS,
  ADAPTER_STATUS_TYPE,
  AdapterNamespaceType,
  BaseAdapter,
  CHAIN_NAMESPACES,
  ChainNamespaceType,
  CONNECTED_EVENT_DATA,
  CustomChainConfig,
  getChainConfig,
  log,
  SafeEventEmitterProvider,
  UserInfo,
  WALLET_ADAPTERS,
  WalletConnectV1Data,
  WalletInitializationError,
  WalletLoginError,
  Web3AuthError,
} from "@web3auth/base";
import { WalletConnectProvider } from "@web3auth/ethereum-provider";

import { WALLET_CONNECT_EXTENSION_ADAPTERS } from "./config";
import { WalletConnectV1AdapterOptions } from "./interface";
// import { isMobile } from "./utils";

function createWrapper(): HTMLElement {
  const wrapper = document.createElement("section");
  wrapper.setAttribute("id", "w3a-container");
  document.body.appendChild(wrapper);
  return wrapper;
}

const htmlToElement = <T extends Element>(html: string): T => {
  const template = window.document.createElement("template");
  const trimmedHtml = html.trim(); // Never return a text node of whitespace as the result
  template.innerHTML = trimmedHtml;
  return template.content.firstChild as T;
};
class WalletConnectV1Adapter extends BaseAdapter<void> {
  readonly name: string = WALLET_ADAPTERS.WALLET_CONNECT_V1;

  readonly adapterNamespace: AdapterNamespaceType = ADAPTER_NAMESPACES.EIP155;

  readonly currentChainNamespace: ChainNamespaceType = CHAIN_NAMESPACES.EIP155;

  readonly type: ADAPTER_CATEGORY_TYPE = ADAPTER_CATEGORY.EXTERNAL;

  readonly adapterOptions: WalletConnectV1AdapterOptions;

  public status: ADAPTER_STATUS_TYPE = ADAPTER_STATUS.NOT_READY;

  public adapterData: WalletConnectV1Data = {
    uri: "",
    extensionAdapters: WALLET_CONNECT_EXTENSION_ADAPTERS,
  };

  public connector: WalletConnect | null = null;

  private wcProvider: WalletConnectProvider | null = null;

  private rehydrated = false;

  private modal: HTMLElement | null = null;

  constructor(options: WalletConnectV1AdapterOptions = {}) {
    super();
    this.adapterOptions = { ...options };
    this.chainConfig = options.chainConfig || null;
  }

  get connected(): boolean {
    return !!this.connector?.connected;
  }

  get provider(): SafeEventEmitterProvider | null {
    return this.wcProvider?.provider || null;
  }

  set provider(_: SafeEventEmitterProvider | null) {
    throw new Error("Not implemented");
  }

  async init(): Promise<void> {
    super.checkInitializationRequirements();
    if (!this.chainConfig) {
      this.chainConfig = getChainConfig(CHAIN_NAMESPACES.EIP155, 1);
    }
    // Create a connector
    this.connector = this.getWalletConnectInstance();
    this.wcProvider = new WalletConnectProvider({ config: { chainConfig: this.chainConfig as CustomChainConfig }, connector: this.connector });

    this.emit(ADAPTER_EVENTS.READY, WALLET_ADAPTERS.WALLET_CONNECT_V1);
    this.status = ADAPTER_STATUS.READY;
    this.modal = createWrapper();
    const header = htmlToElement(
      `<div id="wc-connector">
        <button class="wc-test-button-connect">Connect</button>
        <button class="wc-test-button-cancel">Cancel</button>
      </div>`
    );
    this.modal.appendChild(header);

    if (this.connector.connected) {
      this.rehydrated = true;
      await this.onConnectHandler({ accounts: this.connector.accounts, chainId: this.connector.chainId });
    }
  }

  async connect(): Promise<SafeEventEmitterProvider | null> {
    super.checkConnectionRequirements();
    if (!this.connector) throw WalletInitializationError.notReady("Wallet adapter is not ready yet");

    if (this.connected) {
      await this.onConnectHandler({ accounts: this.connector.accounts, chainId: this.connector.chainId });
      return this.provider;
    }

    if (this.status !== ADAPTER_STATUS.CONNECTING) {
      // for wallet connect qr code modal we have to create a new connector, coz wallet connect internally does not open
      // modal again on existing instance if connection is pending.
      if (this.adapterOptions.adapterSettings?.qrcodeModal) {
        this.connector = this.getWalletConnectInstance();
        this.wcProvider = new WalletConnectProvider({ config: { chainConfig: this.chainConfig as CustomChainConfig }, connector: this.connector });
      }
      await this.createNewSession();
      this.status = ADAPTER_STATUS.CONNECTING;
      this.emit(ADAPTER_EVENTS.CONNECTING, { adapter: WALLET_ADAPTERS.WALLET_CONNECT_V1 });
    }
    return new Promise((resolve, reject) => {
      if (!this.connector) return reject(WalletInitializationError.notReady("Wallet adapter is not ready yet"));
      // for wallet connect default modal.
      this.connector.on("modal_closed", async () => {
        this.status = ADAPTER_STATUS.READY;
        this.emit(ADAPTER_EVENTS.READY, WALLET_ADAPTERS.WALLET_CONNECT_V1);
        return reject(new Error("User closed modal"));
      });
      try {
        // Subscribe to session connection
        this.connector.on("connect", async (error: Error | null, payload: { params: { accounts: string[]; chainId: number }[] }) => {
          if (error) {
            this.emit(ADAPTER_EVENTS.ERRORED, error);
          }
          log.debug("connected event emitted by web3auth");
          await this.onConnectHandler(payload.params[0]);
          return resolve(this.provider);
        });
      } catch (error: unknown) {
        log.error("Wallet connect v1 adapter error while connecting", error);
        // ready again to be connected
        this.status = ADAPTER_STATUS.READY;
        this.rehydrated = true;
        this.emit(ADAPTER_EVENTS.ERRORED, error);
        reject(
          error instanceof Web3AuthError
            ? error
            : WalletLoginError.connectionError(`Failed to login with wallet connect: ${(error as Error)?.message || ""}`)
        );
      }
    });
  }

  async getUserInfo(): Promise<Partial<UserInfo>> {
    if (!this.connected) throw WalletLoginError.notConnectedError("Not connected with wallet, Please login/connect first");
    return {};
  }

  async disconnect(options: { cleanup: boolean } = { cleanup: false }): Promise<void> {
    const { cleanup } = options;
    if (!this.connector || !this.connected) throw WalletLoginError.notConnectedError("Not connected with wallet");
    await this.connector.killSession();
    this.rehydrated = false;
    if (cleanup) {
      this.connector = null;
      this.status = ADAPTER_STATUS.NOT_READY;
      this.wcProvider = null;
    } else {
      // ready to connect again
      this.status = ADAPTER_STATUS.READY;
    }
    this.emit(ADAPTER_EVENTS.DISCONNECTED);
  }

  private showSwitchChainModal() {
    return new Promise((resolve, reject) => {
      try {
        if (!this.modal) return reject(new Error("Chain switch modal is not initialized"));
        this.modal.getElementsByClassName("wc-test-button-connect")[0].addEventListener("click", async () => {
          // eslint-disable-next-line no-console
          console.log("clicked on connect");
          await (this.wcProvider as WalletConnectProvider).switchChain({ chainId: this.chainConfig?.chainId as string, lookup: false });
          return resolve(null);
        });
        this.modal.getElementsByClassName("wc-test-button-cancel")[0].addEventListener("click", async () => {
          // eslint-disable-next-line no-console
          console.log("clicked on cancel");
          return reject(new Error("User cancelled chain switch"));
        });
      } catch (error) {
        log.error("error while chain switch", error);
        return reject(error);
      }
    });
  }

  private async createNewSession(opts: { forceNewSession: boolean } = { forceNewSession: false }): Promise<void> {
    if (!this.connector) throw WalletInitializationError.notReady("Wallet adapter is not ready yet");
    if (opts.forceNewSession && this.connector.pending) {
      await this.connector.killSession();
    }
    // for wallet connect qr modal
    if (this.adapterOptions?.adapterSettings?.qrcodeModal) {
      await this.connector.createSession({ chainId: parseInt(this.chainConfig?.chainId || "0x1", 16) });
      return;
    }

    // for web3auth qr code modal
    return new Promise<void>((resolve, reject) => {
      if (!this.connector) return reject(WalletInitializationError.notReady("Wallet adapter is not ready yet"));
      log.debug("creating new session for web3auth wallet connect");
      this.connector.on("display_uri", async (err, payload) => {
        if (err) {
          this.emit(ADAPTER_EVENTS.ERRORED, WalletLoginError.connectionError("Failed to display wallet connect qr code"));
          return reject(err);
        }
        const uri = payload.params[0];
        this.updateAdapterData({ uri, extensionAdapters: WALLET_CONNECT_EXTENSION_ADAPTERS } as WalletConnectV1Data);

        this.connector?.off("display_uri");
        return resolve();
      });

      this.connector.createSession({ chainId: parseInt(this.chainConfig?.chainId || "0x1", 16) }).catch((error) => {
        log.error("error while creating new wallet connect session", error);
        this.emit(ADAPTER_EVENTS.ERRORED, error);
        return reject(error);
      });
    });
  }

  private async onConnectHandler(params: { accounts: string[]; chainId: number }) {
    if (!this.connector || !this.wcProvider) throw WalletInitializationError.notReady("Wallet adapter is not ready yet");
    if (!this.chainConfig) throw WalletInitializationError.invalidParams("Chain config is not set");

    const { chainId } = params;
    log.debug("connected chainId in hex");
    if (chainId !== parseInt(this.chainConfig.chainId, 16)) {
      try {
        log.debug("added events");
        await this.showSwitchChainModal();
        log.debug("switched chainId in hex");
      } catch (error) {
        log.error("error while chain switching", error);
        // we need to create a new session since old session is already used and
        // user needs to login again with correct chain with new qr code.
        await this.createNewSession({ forceNewSession: true });
        const connectedChainConfig = getChainConfig(CHAIN_NAMESPACES.EIP155, chainId);
        this.emit(
          ADAPTER_EVENTS.ERRORED,
          WalletInitializationError.fromCode(
            5000,
            `Not connected to correct network. Expected: ${this.chainConfig.displayName}, Current: ${
              connectedChainConfig?.displayName || chainId
            }, Please switch to correct network from wallet`
          )
        );
        this.status = ADAPTER_STATUS.READY;
        this.rehydrated = true;
        return;
      }
    }
    await this.wcProvider.setupProvider(this.connector);
    this.subscribeEvents(this.connector);
    this.status = ADAPTER_STATUS.CONNECTED;
    this.emit(ADAPTER_EVENTS.CONNECTED, { adapter: WALLET_ADAPTERS.WALLET_CONNECT_V1, reconnected: this.rehydrated } as CONNECTED_EVENT_DATA);
  }

  private subscribeEvents(connector: WalletConnect): void {
    connector.on("session_update", async (error: Error | null) => {
      if (error) {
        this.emit(ADAPTER_EVENTS.ERRORED, error);
      }
    });
  }

  private getWalletConnectInstance(): WalletConnect {
    const walletConnectOptions = this.adapterOptions.adapterSettings || {};
    walletConnectOptions.bridge = walletConnectOptions.bridge || "https://bridge.walletconnect.org";
    // Create a connector
    return new WalletConnect(walletConnectOptions);
  }
}

export { WalletConnectV1Adapter };
