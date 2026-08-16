import { Request, Response } from 'express';
import { VobizService } from '../services/vobiz.service';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';
import { EncryptionService } from '../utils/EncryptionService';

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
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch inventory' });
    }
  }

  /**
   * GET /api/telephony/sub-accounts
   * Retrieves an existing Sub-Account for the authenticated user from the DB.
   */
  public static async getSubAccount(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || 'anonymous';
      if (userId === 'anonymous') {
         return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const existing = await prisma.vobizSubAccount.findUnique({
        where: { userId },
      });

      if (!existing) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }

      return res.status(200).json({
        success: true,
        subAccount: {
          api_id: existing.id,
          auth_id: existing.authId,
          auth_token: existing.authToken,
          message: 'Retrieved existing sub-account'
        },
      });
    } catch (error: any) {
      logger.error('TelephonyController.getSubAccount failed', { error: error.message });
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch sub-account' });
    }
  }

  /**
   * POST /api/telephony/sub-accounts
   * Provisions a Sub-Account for the authenticated user and saves it to the DB.
   */
  public static async provisionSubAccount(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || 'anonymous';
      
      // Safety check: if they already have one, just return it
      if (userId !== 'anonymous') {
        const existing = await prisma.vobizSubAccount.findUnique({
          where: { userId },
        });
        if (existing) {
          return res.status(200).json({
            success: true,
            subAccount: {
              api_id: existing.id,
              auth_id: existing.authId,
              auth_token: existing.authToken,
              message: 'Retrieved existing sub-account'
            },
          });
        }
      }

      const orgName = (req as any).user?.fullName || 'User';
      const orgIdPrefix = userId.substring(0, 8);

      const vobizResponse = await VobizService.provisionSubAccount(orgIdPrefix, orgName);

      // Persist the sub-account so they don't lose it on refresh
      if (userId !== 'anonymous' && vobizResponse.auth_id && vobizResponse.auth_token) {
        const encryptedToken = EncryptionService.encrypt(vobizResponse.auth_token);
        await prisma.vobizSubAccount.create({
          data: {
            userId,
            authId: vobizResponse.auth_id,
            authToken: encryptedToken,
            kycMode: 'personal_use',
          },
        });
      }

      return res.status(200).json({
        success: true,
        subAccount: vobizResponse,
      });
    } catch (error: any) {
      logger.error('TelephonyController.provisionSubAccount failed', { error: error.message });
      return res.status(500).json({ success: false, error: error.message || 'Failed to provision sub-account' });
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
      return res.status(500).json({ success: false, error: error.message || 'Failed to purchase and assign DID' });
    }
  }
}
