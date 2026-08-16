import { Request, Response } from 'express';
import { VobizService } from '../services/vobiz.service';
import { prisma } from '../lib/prisma';
import { logger } from '../utils/logger';

export class TelephonyController {
  /**
   * GET /api/telephony/inventory
   * Fetches live inventory from Vobiz and normalizes the response.
   */
  public static async getInventory(req: Request, res: Response) {
    try {
      const country = (req.query.country as string) || 'IN';
      const page = parseInt(req.query.page as string) || 1;
      const perPage = parseInt(req.query.perPage as string) || 25;
      const search = req.query.search as string;

      const vobizResponse = await VobizService.getInventory({
        country,
        page,
        per_page: perPage,
        search,
      });

      // Normalize response according to requirements
      // Assuming Vobiz returns numbers in a 'numbers' or 'data' array
      const rawNumbers = Array.isArray(vobizResponse) 
        ? vobizResponse 
        : (vobizResponse.numbers || vobizResponse.data || []);
      
      const total = vobizResponse.total || rawNumbers.length;

      const items = rawNumbers.map((num: any) => ({
        id: num.id || num.number_id,
        e164: num.e164 || num.number,
        country: num.country || country,
        region: num.region || 'Unknown',
        setupFee: num.setup_fee || 0,
        monthlyFee: num.monthly_fee || 0,
        currency: num.currency || 'USD',
        capabilities: num.capabilities || { voice: true, sms: false },
      }));

      return res.status(200).json({
        success: true,
        items,
        total,
        page,
        perPage,
      });
    } catch (error: any) {
      logger.error('TelephonyController.getInventory failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Failed to fetch inventory' });
    }
  }

  /**
   * POST /api/telephony/sub-accounts
   * Provisions a Sub-Account for the authenticated user.
   */
  public static async provisionSubAccount(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || 'anonymous';
      const orgName = (req as any).user?.fullName || 'User';
      const orgIdPrefix = userId.substring(0, 8);

      const vobizResponse = await VobizService.provisionSubAccount(orgIdPrefix, orgName);

      return res.status(200).json({
        success: true,
        subAccount: vobizResponse,
      });
    } catch (error: any) {
      logger.error('TelephonyController.provisionSubAccount failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Failed to provision sub-account' });
    }
  }

  /**
   * POST /api/telephony/purchase
   * Purchases a DID and assigns it to a sub-account.
   */
  public static async purchaseAndAssign(req: Request, res: Response) {
    try {
      const { numberId, subAuthId } = req.body;
      
      if (!numberId || !subAuthId) {
        return res.status(400).json({ success: false, error: 'Missing numberId or subAuthId' });
      }

      // 1. Purchase DID
      const purchaseRes = await VobizService.purchaseDid(numberId);
      const purchasedE164 = purchaseRes.e164 || purchaseRes.number || purchaseRes.number_e164;

      if (!purchasedE164) {
         throw new Error('Could not determine purchased E.164 from response');
      }

      // 2. Assign to Sub-Account
      const assignRes = await VobizService.assignDidToSubAccount(subAuthId, purchasedE164);

      return res.status(200).json({
        success: true,
        purchasedE164,
        assignRes,
      });
    } catch (error: any) {
      logger.error('TelephonyController.purchaseAndAssign failed', { error: error.message });
      return res.status(500).json({ success: false, error: 'Failed to purchase and assign DID' });
    }
  }
}
