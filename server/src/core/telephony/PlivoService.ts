import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { EncryptionService } from '../../utils/EncryptionService';
import { ownedAgentIdOrNull } from '../../utils/agentOwnership';

export interface PlivoNumberItem {
  id: string;
  number: string;
  country: string;
  region: string;
  prefix?: string;
  type: string;
  monthlyRental: number;
  setupFee: number;
  taxes: number;
  totalMonthlyCost: number;
  currency: string;
  capabilities: { voice: boolean; sms: boolean; mms: boolean };
  kycRequirement: string;
  status: string;
}

export class PlivoService {
  private parentAuthId: string;
  private parentAuthToken: string;
  // PLIVO_API_BASE exists only so automated tests can point at a fake Plivo API. Default is production Plivo.
  private baseUrl = (process.env.PLIVO_API_BASE || 'https://api.plivo.com/v1').replace(/\/+$/, '');

  constructor() {
    this.parentAuthId = (process.env.PLIVO_AUTH_ID || env.PLIVO_AUTH_ID || '').trim();
    this.parentAuthToken = (process.env.PLIVO_AUTH_TOKEN || env.PLIVO_AUTH_TOKEN || '').trim();

    if (!this.parentAuthId || !this.parentAuthToken) {
      logger.warn('[PLIVO] PLIVO_AUTH_ID or PLIVO_AUTH_TOKEN is not configured in environment.');
    }
  }

  private hasValidCredentials(): boolean {
    return Boolean(
      this.parentAuthId &&
      this.parentAuthToken &&
      !this.parentAuthId.includes('your_') &&
      this.parentAuthId.length > 5
    );
  }

  /**
   * Without carrier keys the service simulates results for local development. In production that
   * would hand customers fake numbers and fake calls (audit #14), so it refuses instead.
   */
  private refuseSimulationInProduction(action: string): void {
    if ((process.env.NODE_ENV || env.NODE_ENV) === 'production') {
      logger.error('[ADMIN_ALERT][PLIVO_CONFIG] carrier credentials missing in production; refusing to simulate', { action });
      throw new Error('This carrier is not available right now. Please try again later or contact support.');
    }
  }

  private getParentHeaders() {
    const creds = Buffer.from(`${this.parentAuthId}:${this.parentAuthToken}`).toString('base64');
    return {
      'Authorization': `Basic ${creds}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Claritiy-Voice/2.0',
    };
  }

  /**
   * India business KYC (Plivo "Regulatory Compliance"). Indian numbers can only be rented and used
   * with an ACCEPTED compliance application, filed for the customer's own subaccount (main-account
   * credentials, `subaccount` in the data JSON). Plivo documents India requirements for businesses
   * only: a Registration Certificate (Certificate of Incorporation or Udyam, field business_name) and
   * a GST Registration Certificate, PDF/JPEG/PNG up to 5 MB each.
   */
  async getIndiaBusinessRequirements(): Promise<{ requirementId: string; registrationDocTypeId: string; gstDocTypeId: string; registrationFields: string[] }> {
    if (!this.hasValidCredentials()) throw new Error('Carrier credentials not configured');
    const res = await fetch(`${this.baseUrl}/Account/${this.parentAuthId}/PhoneNumber/Compliance/Requirements?country_iso=IN&number_type=local&user_type=business`, { headers: this.getParentHeaders() });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Compliance requirements unavailable (${res.status})`);
    const types: any[] = Array.isArray(data.document_types) ? data.document_types : [];
    const reg = types.find((t) => /registration|incorporation|udyam/i.test(String(t.name || '')) && !/gst/i.test(String(t.name || '')));
    const gst = types.find((t) => /gst/i.test(String(t.name || '')));
    if (!reg || !gst) throw new Error('Compliance requirements changed: registration or GST document type not found');
    return {
      requirementId: String(data.requirement_id || ''),
      registrationDocTypeId: String(reg.document_type_id),
      gstDocTypeId: String(gst.document_type_id),
      registrationFields: (Array.isArray(reg.required_fields) ? reg.required_fields : []).map((f: any) => String(f.field_name)),
    };
  }

  async submitIndiaBusinessCompliance(p: {
    subaccountAuthId: string;
    alias: string;
    endUser: { name: string; email: string; address_line1: string; address_line2?: string; city: string; state: string; postal_code: string; registration_number?: string };
    businessName: string;
    registrationFile: { name: string; mimeType: string; buffer: Buffer };
    gstFile: { name: string; mimeType: string; buffer: Buffer };
    callbackUrl?: string;
  }): Promise<{ complianceId: string }> {
    const req = await this.getIndiaBusinessRequirements();
    const data = {
      country_iso: 'IN',
      number_type: 'local',
      alias: p.alias.slice(0, 120),
      end_user: { type: 'business', ...p.endUser, country: 'IN' },
      documents: [
        { document_type_id: req.registrationDocTypeId, data_fields: { business_name: p.businessName } },
        { document_type_id: req.gstDocTypeId },
      ],
      subaccount: p.subaccountAuthId,
      ...(p.callbackUrl ? { callback_url: p.callbackUrl, callback_method: 'POST' } : {}),
    };
    const form = new FormData();
    form.append('data', JSON.stringify(data));
    form.append('documents[0].file', new Blob([new Uint8Array(p.registrationFile.buffer)], { type: p.registrationFile.mimeType }), p.registrationFile.name);
    form.append('documents[1].file', new Blob([new Uint8Array(p.gstFile.buffer)], { type: p.gstFile.mimeType }), p.gstFile.name);
    const headers: Record<string, string> = { ...this.getParentHeaders() };
    delete headers['Content-Type']; // fetch sets the multipart boundary
    const res = await fetch(`${this.baseUrl}/Account/${this.parentAuthId}/PhoneNumber/Compliance/`, { method: 'POST', headers, body: form });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body.compliance_id) {
      throw new Error(`Compliance application refused (${res.status}): ${String(body.error || body.message || '').slice(0, 200)}`);
    }
    return { complianceId: String(body.compliance_id) };
  }

  /** Current review state of a compliance application. */
  async getComplianceApplication(complianceId: string, subaccountAuthId?: string): Promise<{ status: string; rejectionReason: string | null } | null> {
    if (!this.hasValidCredentials()) return null;
    const q = subaccountAuthId ? `?subaccount=${encodeURIComponent(subaccountAuthId)}` : '';
    const res = await fetch(`${this.baseUrl}/Account/${this.parentAuthId}/PhoneNumber/Compliance/${encodeURIComponent(complianceId)}${q}`, { headers: this.getParentHeaders() });
    if (!res.ok) return null;
    const body: any = await res.json().catch(() => ({}));
    const c = body.compliance || body;
    return { status: String(c.status || 'submitted').toLowerCase(), rejectionReason: c.rejection_reason ?? null };
  }

  /**
   * Unrents a number (Plivo "Unrent a number": DELETE /Account/{auth_id}/Number/{number}/), so the
   * main account stops paying its monthly rental. 404 = already gone.
   */
  async unrentNumber(number: string): Promise<'released' | 'already_gone' | 'failed' | 'no_credentials'> {
    if (!this.hasValidCredentials()) return 'no_credentials';
    const digits = String(number || '').replace(/\D/g, '');
    try {
      const res = await fetch(`${this.baseUrl}/Account/${this.parentAuthId}/Number/${digits}/`, {
        method: 'DELETE',
        headers: this.getParentHeaders(),
      });
      if (res.status === 204 || res.ok) return 'released';
      if (res.status === 404) return 'already_gone';
      logger.error('[PLIVO] unrent number failed', { number: `***${digits.slice(-4)}`, status: res.status, body: (await res.text().catch(() => '')).slice(0, 200) });
      return 'failed';
    } catch (err) {
      logger.error('[PLIVO] unrent number error', { error: String(err) });
      return 'failed';
    }
  }

  /**
   * Idempotent Subaccount Provisioning:
   * 1. Checks local database for existing PlivoSubAccount.
   * 2. If not found locally, queries Plivo Subaccount list to verify if a subaccount with that name exists.
   * 3. Creates the subaccount via Plivo API if missing.
   * 4. Stores encrypted subaccount authToken at rest.
   */
  async getOrCreateSubaccount(userId: string, workspaceName?: string): Promise<{ authId: string; authToken: string }> {
    // 1. Check DB first
    const existing = await prisma.plivoSubAccount.findUnique({ where: { userId } });
    if (existing) {
      return {
        authId: existing.authId,
        authToken: EncryptionService.decrypt(existing.authToken),
      };
    }

    const cleanName = (workspaceName || 'Org').replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
    const subaccountName = `Claritiy_${userId.substring(0, 8)}_${cleanName}`;

    // If no credentials configured, generate a simulated subaccount in dev/test
    if (!this.hasValidCredentials()) {
      this.refuseSimulationInProduction('subaccount');
      logger.info('[PLIVO_SUBACCOUNT] Operating in dev fallback mode (no parent credentials configured).');
      const mockAuthId = `SA_${userId.substring(0, 8).toUpperCase()}_MOCK`;
      const mockToken = Buffer.from(`mock_token_${Date.now()}`).toString('base64');
      const encrypted = EncryptionService.encrypt(mockToken);

      const record = await prisma.plivoSubAccount.create({
        data: {
          userId,
          authId: mockAuthId,
          authToken: encrypted,
          name: subaccountName,
          enabled: true,
        },
      });

      return { authId: record.authId, authToken: mockToken };
    }

    try {
      // 2. Query Plivo Subaccounts to prevent duplicate creation on network retries
      const listUrl = `${this.baseUrl}/Account/${this.parentAuthId}/Subaccount/?limit=20`;
      const listRes = await fetch(listUrl, { headers: this.getParentHeaders() });
      if (listRes.ok) {
        const listData: any = await listRes.json();
        const matched = (listData.objects || []).find((s: any) => s.name === subaccountName);
        if (matched && matched.auth_id && matched.auth_token) {
          logger.info('[PLIVO_SUBACCOUNT] Found existing subaccount in Plivo during idempotent lookup', {
            userId,
            authId: matched.auth_id,
          });
          const encrypted = EncryptionService.encrypt(matched.auth_token);
          await prisma.plivoSubAccount.create({
            data: {
              userId,
              authId: matched.auth_id,
              authToken: encrypted,
              name: subaccountName,
              enabled: true,
            },
          });
          return { authId: matched.auth_id, authToken: matched.auth_token };
        }
      }

      // 3. Create subaccount via Plivo API
      const createUrl = `${this.baseUrl}/Account/${this.parentAuthId}/Subaccount/`;
      const createRes = await fetch(createUrl, {
        method: 'POST',
        headers: this.getParentHeaders(),
        body: JSON.stringify({
          name: subaccountName,
          enabled: true,
        }),
      });

      const createData: any = await createRes.json();
      if (!createRes.ok || !createData.auth_id) {
        const errorMsg = createData.message || JSON.stringify(createData);
        throw new Error(`Failed to create Plivo subaccount: ${errorMsg}`);
      }

      const encrypted = EncryptionService.encrypt(createData.auth_token);
      await prisma.plivoSubAccount.create({
        data: {
          userId,
          authId: createData.auth_id,
          authToken: encrypted,
          name: subaccountName,
          enabled: true,
        },
      });

      logger.info('[PLIVO_SUBACCOUNT] Successfully created and mapped Plivo subaccount', {
        userId,
        authId: createData.auth_id,
      });

      return { authId: createData.auth_id, authToken: createData.auth_token };
    } catch (err: any) {
      logger.error('[PLIVO_SUBACCOUNT_ERROR] Subaccount creation failed', {
        userId,
        error: err.message,
      });
      throw err;
    }
  }

  /**
   * Search Indian Local Numbers Only:
   * Plivo requires country_iso=IN and type=local.
   */
  async searchIndianNumbers(params: {
    pattern?: string;
    region?: string;
    page?: number;
    per_page?: number;
  }): Promise<{ items: PlivoNumberItem[]; total: number; page: number; per_page: number; hasMore: boolean }> {
    const page = params.page || 1;
    const perPage = params.per_page || 15;
    const offset = (page - 1) * perPage;

    // Fallback if credentials are not yet configured in Render env
    if (!this.hasValidCredentials()) {
      this.refuseSimulationInProduction('search');
      logger.info('[PLIVO_SEARCH] Returning Indian local catalog preview (mock mode).');
      const previewRegions = [
        { city: 'Mumbai', code: '+9122', prefix: '22' },
        { city: 'Delhi / NCR', code: '+9111', prefix: '11' },
        { city: 'Bengaluru', code: '+9180', prefix: '80' },
        { city: 'Hyderabad', code: '+9140', prefix: '40' },
        { city: 'Chennai', code: '+9144', prefix: '44' },
        { city: 'Kolkata', code: '+9133', prefix: '33' },
        { city: 'Pune', code: '+9120', prefix: '20' },
        { city: 'Ahmedabad', code: '+9179', prefix: '79' },
      ];

      const filteredRegions = params.region
        ? previewRegions.filter((r) => r.city.toLowerCase().includes(params.region!.toLowerCase()))
        : previewRegions;

      const mockItems: PlivoNumberItem[] = filteredRegions.map((reg, idx) => {
        const randTail = 35000000 + (idx * 1111) + page;
        const e164 = `${reg.code}${randTail}`;
        const monthlyRental = 450.0;
        const setupFee = 0.0;
        const taxes = parseFloat((monthlyRental * 0.18).toFixed(2));
        return {
          id: `plivo_in_${reg.prefix}_${randTail}`,
          number: e164,
          country: 'IN',
          region: `${reg.city}, India`,
          prefix: reg.prefix,
          type: 'local',
          monthlyRental,
          setupFee,
          taxes,
          totalMonthlyCost: monthlyRental + setupFee + taxes,
          currency: 'INR',
          capabilities: { voice: true, sms: false, mms: false },
          kycRequirement: 'Statutory DoT Address & Identity Verification required (Aadhaar / PAN)',
          status: 'available',
        };
      });

      return {
        items: mockItems,
        total: previewRegions.length,
        page,
        per_page: perPage,
        hasMore: false,
      };
    }

    try {
      let queryUrl = `${this.baseUrl}/Account/${this.parentAuthId}/PhoneNumber/?country_iso=IN&type=local&limit=${perPage}&offset=${offset}`;
      if (params.pattern) queryUrl += `&pattern=${encodeURIComponent(params.pattern)}`;
      if (params.region) queryUrl += `&region=${encodeURIComponent(params.region)}`;

      const res = await fetch(queryUrl, { headers: this.getParentHeaders() });
      const data: any = await res.json();

      if (!res.ok) {
        throw new Error(`Plivo inventory search error: ${data.message || JSON.stringify(data)}`);
      }

      const objects: any[] = data.objects || [];
      const totalCount = data.meta?.total_count || objects.length;

      const items: PlivoNumberItem[] = objects.map((obj) => {
        const monthlyRental = parseFloat(obj.monthly_rental_rate || '450.00');
        const setupFee = parseFloat(obj.setup_rate || '0.00');
        const taxes = parseFloat((monthlyRental * 0.18).toFixed(2));

        return {
          id: obj.number || obj.resource_uri,
          number: obj.number,
          country: 'IN',
          region: obj.region || obj.city || 'India Local',
          prefix: obj.prefix,
          type: 'local',
          monthlyRental,
          setupFee,
          taxes,
          totalMonthlyCost: monthlyRental + setupFee + taxes,
          currency: 'INR',
          capabilities: {
            voice: !!obj.voice_enabled,
            sms: !!obj.sms_enabled,
            mms: !!obj.mms_enabled,
          },
          kycRequirement: 'Statutory DoT Address & Identity Verification required (Aadhaar / PAN)',
          status: 'available',
        };
      });

      return {
        items,
        total: totalCount,
        page,
        per_page: perPage,
        hasMore: offset + items.length < totalCount,
      };
    } catch (err: any) {
      logger.error('[PLIVO_SEARCH_FAILED]', { error: err.message });
      throw err;
    }
  }

  /**
   * Purchases a number and binds it to the tenant's Plivo subaccount and optional Voice Application.
   */
  async purchaseAndAssignNumber(params: {
    userId: string;
    number: string;
    subaccountAuthId: string;
    agentId?: string;
    expectedPrice?: number;
    setupFee?: number;
    region?: string;
    /** Accepted India compliance application filed for this subaccount (required for +91 numbers). */
    complianceApplicationId?: string;
  }) {
    const { userId, number, subaccountAuthId, agentId, expectedPrice = 450, setupFee = 0, region = 'India Local', complianceApplicationId } = params;

    // If live credentials are valid, execute real Plivo number buy
    let carrierPending = false;
    if (this.hasValidCredentials()) {
      const buyUrl = `${this.baseUrl}/Account/${this.parentAuthId}/PhoneNumber/${number}/`;
      const bodyPayload: Record<string, any> = {
        subaccount: subaccountAuthId,
        ...(complianceApplicationId ? { compliance_application_id: complianceApplicationId } : {}),
      };
      const configuredAppId = process.env.PLIVO_APP_ID || env.PLIVO_APP_ID;
      if (configuredAppId && configuredAppId.trim()) {
        bodyPayload.app_id = configuredAppId.trim();
      }

      const buyRes = await fetch(buyUrl, {
        method: 'POST',
        headers: this.getParentHeaders(),
        body: JSON.stringify(bodyPayload),
      });

      const buyData: any = await buyRes.json();
      // "pending" = Plivo still checking documents for this number (it cannot call yet).
      carrierPending = String(buyData?.status || "").toLowerCase() === "pending" || (Array.isArray(buyData?.numbers) && buyData.numbers.some((n: any) => String(n?.status || "").toLowerCase() === "pending"));
      if (!buyRes.ok || (buyData.status && buyData.status !== 'fulfilled' && buyData.message !== 'created')) {
        const errorMsg = buyData.message || JSON.stringify(buyData);
        throw new Error(`Plivo number purchase error: ${errorMsg}`);
      }

      logger.info('[PLIVO_PURCHASE_SUCCESS] Purchased number via Plivo parent account', {
        userId,
        number,
        subaccountAuthId,
      });
    } else {
      this.refuseSimulationInProduction('purchase');
      logger.info('[PLIVO_PURCHASE_MOCK] Simulating Plivo number purchase in dev mode', {
        userId,
        number,
        subaccountAuthId,
      });
    }

    // Provision PhoneNumber row in Claritiy Voice DB
    const provisioned = await prisma.phoneNumber.create({
      data: {
        userId,
        phoneNumber: number,
        assignedAgentId: await ownedAgentIdOrNull(userId, agentId), // tenant isolation
        countryCode: 'IN',
        region: region || 'India Local',
        type: 'local',
        telephonyProvider: 'plivo',
        capabilities: JSON.stringify(['voice']),
        status: carrierPending ? 'activation_pending' : 'active',
        kycStatus: carrierPending ? 'pending' : 'verified',
        aadhaarRequired: carrierPending,
        monthlyCost: expectedPrice,
        setupFee,
        currency: 'INR',
        plivoNumberId: number,
        plivoSubAuthId: subaccountAuthId,
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Enforce permanent number locked state for customer free bundle
    await prisma.user.update({
      where: { id: userId },
      data: { numberLocked: true },
    });

    return provisioned;
  }

  /**
   * Initiates an outbound phone call using Plivo Voice API.
   * POST https://api.plivo.com/v1/Account/{auth_id}/Call/
   */
  async initiateCall(params: {
    to: string;
    from: string;
    answerUrl: string;
    hangupUrl?: string;
    ringUrl?: string;
    record?: boolean;
    userId?: string;
    subaccountAuthId?: string;
  }): Promise<{ requestUuid: string }> {
    const { to, from, answerUrl, hangupUrl, ringUrl } = params;

    if (!this.hasValidCredentials()) {
      this.refuseSimulationInProduction('call');
      logger.info('[PLIVO_OUTBOUND_MOCK] Simulating Plivo outbound call in dev mode', { to, from });
      return { requestUuid: `plivo_mock_${Date.now()}` };
    }

    let authId = this.parentAuthId;
    let authHeaders = this.getParentHeaders();

    if (params.subaccountAuthId) {
      const sub = await prisma.plivoSubAccount.findFirst({
        where: { authId: params.subaccountAuthId },
      });
      if (sub && sub.authToken !== 'DIRECT_PARENT_ACCOUNT') {
        authId = sub.authId;
        const decryptedToken = EncryptionService.decrypt(sub.authToken);
        const creds = Buffer.from(`${authId}:${decryptedToken}`).toString('base64');
        authHeaders = {
          'Authorization': `Basic ${creds}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Claritiy-Voice/2.0',
        };
      }
    }

    const callEndpoint = `${this.baseUrl}/Account/${authId}/Call/`;
    const payload: Record<string, any> = {
      from,
      to,
      answer_url: answerUrl,
      answer_method: 'POST',
    };

    if (hangupUrl) {
      payload.hangup_url = hangupUrl;
      payload.hangup_method = 'POST';
    }

    if (ringUrl) {
      payload.ring_url = ringUrl;
      payload.ring_method = 'POST';
    }

    logger.info('[PLIVO_OUTBOUND_CALL] Dispatching call via Plivo API', { endpoint: callEndpoint, from, to });

    const response = await fetch(callEndpoint, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    });

    const data: any = await response.json();
    const requestUuid = data.request_uuid || (Array.isArray(data.request_uuid) ? data.request_uuid[0] : null);

    if (!response.ok || !requestUuid) {
      const errorMsg = data.message || JSON.stringify(data);
      logger.error('[PLIVO_OUTBOUND_ERROR] Call initiation failed', { status: response.status, data });
      throw new Error(`Plivo call initiation failed: ${errorMsg}`);
    }

    logger.info('[PLIVO_OUTBOUND_SUCCESS] Outbound call fired', { requestUuid });
    return { requestUuid };
  }

  /**
   * Terminates an active Plivo call session immediately.
   * DELETE https://api.plivo.com/v1/Account/{auth_id}/Call/{call_uuid}/   (documented success: 204)
   *
   * Credentials are tried in order: the sub-account that owns the call (if any), then the parent account.
   * The previous version only used the parent account, ignored the HTTP status and never reported failure,
   * so a hangup that did nothing looked identical to one that worked.
   *
   * SAFETY: Plivo disconnects ALL ongoing calls on the account when CallUUID is omitted, so an empty or
   * malformed UUID must never reach the API.
   *
   * @returns 'hung_up' (2xx), 'already_ended' (404/410 on every credential), or 'failed' (anything else)
   */
  async terminateCall(callUuid: string, opts: { subAuthId?: string | null } = {}): Promise<'hung_up' | 'already_ended' | 'failed' | 'no_credentials'> {
    const uuid = (callUuid || '').trim();
    if (!uuid || !/^[A-Za-z0-9-]{8,64}$/.test(uuid)) {
      logger.error('[PLIVO_TERMINATE_REFUSED] Refusing to send hangup with an empty/invalid call UUID', { callUuid });
      return 'failed';
    }
    if (!this.hasValidCredentials()) return 'no_credentials';

    const candidates: Array<{ authId: string; headers: Record<string, string>; label: string }> = [];
    if (opts.subAuthId) {
      try {
        const sub = await prisma.plivoSubAccount.findFirst({ where: { authId: opts.subAuthId } });
        if (sub && sub.authToken !== 'DIRECT_PARENT_ACCOUNT') {
          const token = EncryptionService.decrypt(sub.authToken);
          const creds = Buffer.from(`${sub.authId}:${token}`).toString('base64');
          candidates.push({
            authId: sub.authId,
            label: 'subaccount',
            headers: { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json', 'User-Agent': 'Claritiy-Voice/2.0' },
          });
        }
      } catch (err: any) {
        logger.warn('[PLIVO_TERMINATE] Could not load sub-account credentials, using parent only', { error: err?.message });
      }
    }
    candidates.push({ authId: this.parentAuthId, headers: this.getParentHeaders() as Record<string, string>, label: 'parent' });

    let sawNotFound = false;
    for (const c of candidates) {
      try {
        const response = await fetch(`${this.baseUrl}/Account/${c.authId}/Call/${uuid}/`, { method: 'DELETE', headers: c.headers });
        logger.info('[PLIVO_TERMINATE_CALL]', { callUuid: uuid, status: response.status, credential: c.label });
        if (response.status >= 200 && response.status < 300) return 'hung_up';
        if (response.status === 404 || response.status === 410) { sawNotFound = true; continue; }
        // 401/403/429/5xx: this credential failed in a way that is NOT "call already ended"
        logger.warn('[PLIVO_TERMINATE_NON_SUCCESS]', { callUuid: uuid, status: response.status, credential: c.label });
      } catch (err: any) {
        logger.warn('[PLIVO_TERMINATE_FAILED]', { callUuid: uuid, credential: c.label, error: err.message });
      }
    }
    return sawNotFound ? 'already_ended' : 'failed';
  }
}


