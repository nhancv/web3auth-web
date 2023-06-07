import { createEventEmitterProxy, providerFromEngine } from "@toruslabs/base-controllers";
import { createAsyncMiddleware, createScaffoldMiddleware, JRPCEngine, JRPCMiddleware, JRPCRequest, JRPCResponse } from "@toruslabs/openlogin-jrpc";
import { CustomChainConfig, SafeEventEmitterProvider } from "@web3auth/base";

import { IBaseProvider } from "./IBaseProvider";

export class CommonPrivateKeyProvider implements IBaseProvider<string> {
  // should be Assigned in setupProvider
  public _providerEngineProxy: SafeEventEmitterProvider | null = null;

  get provider(): SafeEventEmitterProvider | null {
    return this._providerEngineProxy;
  }

  set provider(_) {
    throw new Error("Method not implemented.");
  }

  public static getProviderInstance = async (params: { privKey: string }): Promise<CommonPrivateKeyProvider> => {
    const providerFactory = new CommonPrivateKeyProvider();
    await providerFactory.setupProvider(params.privKey);
    return providerFactory;
  };

  addChain(_: CustomChainConfig): void {
    throw new Error("Method not implemented.");
  }

  public async setupProvider(privKey: string): Promise<void> {
    const privKeyMiddleware = this.getPrivKeyMiddleware(privKey);
    const engine = new JRPCEngine();
    engine.push(privKeyMiddleware);
    const provider = providerFromEngine(engine);
    this.updateProviderEngineProxy(provider);
  }

  public async switchChain(_: { chainId: string }): Promise<void> {
    return Promise.resolve();
  }

  protected getProviderEngineProxy(): SafeEventEmitterProvider | null {
    return this._providerEngineProxy;
  }

  protected updateProviderEngineProxy(provider: SafeEventEmitterProvider) {
    if (this._providerEngineProxy) {
      (this._providerEngineProxy as any).setTarget(provider);
    } else {
      this._providerEngineProxy = createEventEmitterProxy<SafeEventEmitterProvider>(provider);
    }
  }

  private getPrivKeyMiddleware(privKey: string): JRPCMiddleware<unknown, unknown> {
    const middleware = {
      getPrivatekey: async (): Promise<string> => {
        return privKey;
      },
    };
    return this.createPrivKeyMiddleware(middleware);
  }

  private createPrivKeyMiddleware({ getPrivatekey }): JRPCMiddleware<unknown, unknown> {
    async function getPrivatekeyHandler(_: JRPCRequest<{ privateKey: string }[]>, res: JRPCResponse<unknown>): Promise<void> {
      res.result = await getPrivatekey();
    }

    return createScaffoldMiddleware({
      private_key: createAsyncMiddleware(getPrivatekeyHandler),
    });
  }
}
