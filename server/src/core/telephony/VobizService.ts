import { ProviderManager } from '../../providers/ProviderManager';
import { InitiateCallParams, InitiateCallResult } from '../../providers/interfaces/IProvider';

export class VobizService {
  /**
   * Delegates calls placement to Vobiz telephony provider.
   */
  static async placeCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    const telephony = ProviderManager.instance.getTelephonyProvider();
    return telephony.initiateCall(params);
  }

  /**
   * Terminates active telephony call.
   */
  static async terminateCall(callUuid: string): Promise<void> {
    const telephony = ProviderManager.instance.getTelephonyProvider();
    await telephony.terminateCall(callUuid);
  }
}
