import { ProviderManager } from '../../providers/ProviderManager';
import { InitiateCallParams, InitiateCallResult } from '../../providers/interfaces/IProvider';

export class VobizService {
  /**
   * Delegates calls placement to Vobiz telephony provider.
   */
  static async placeCall(params: InitiateCallParams): Promise<InitiateCallResult> {
    if (!process.env.VOBIZ_FROM_NUMBER || !process.env.VOBIZ_AUTH_TOKEN) {
      console.error("CRITICAL CONFIGURATION ERROR: Backend is missing vital Vobiz credentials (VOBIZ_FROM_NUMBER / VOBIZ_AUTH_TOKEN). Aborting outbound dialing pipeline.");
      throw new Error("Telephony configuration missing on backend server engine.");
    }
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
