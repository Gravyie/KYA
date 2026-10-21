import {KYAClient} from '@kya/sdk';
import {config} from './config.js';

let instance = null;

/** Single shared read client. Cheap to reuse, and keeps RPC connections bounded. */
export function kyaClient() {
  if (!instance) {
    instance = new KYAClient({
      chainId: config.chainId,
      rpcUrl: config.rpcUrl,
      contracts: config.contracts,
    });
  }
  return instance;
}
