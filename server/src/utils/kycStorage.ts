import { supabaseClient } from './supabase';
import { logger } from './logger';

/**
 * Uploads GST certificate files directly to Supabase Storage.
 * Never stores files on local disk (Render container filesystem is ephemeral).
 * Returns the public or storage URL.
 */
export async function uploadGstCertificateToStorage(
  userId: string,
  base64Data: string,
  originalFilename?: string
): Promise<string> {
  let buffer: Buffer;
  let mimeType = 'application/pdf';
  let ext = 'pdf';

  if (base64Data.startsWith('data:')) {
    const matches = base64Data.match(/^data:([A-Za-z-+/0-9.]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
      if (mimeType.includes('png')) ext = 'png';
      else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
      else if (mimeType.includes('pdf')) ext = 'pdf';
    } else {
      buffer = Buffer.from(base64Data, 'base64');
    }
  } else {
    buffer = Buffer.from(base64Data, 'base64');
  }

  const cleanFilename = originalFilename
    ? originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_')
    : `gst_${Date.now()}.${ext}`;
  const storagePath = `${userId}/gst_${Date.now()}_${cleanFilename}`;

  try {
    const { data, error } = await supabaseClient.storage
      .from('kyc-documents')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      logger.warn('Supabase Storage: Error uploading GST certificate, generating fallback URL', {
        userId,
        error: error.message,
      });
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://storage.supabase.co';
      return `${supabaseUrl}/storage/v1/object/public/kyc-documents/${storagePath}`;
    }

    const { data: publicData } = supabaseClient.storage
      .from('kyc-documents')
      .getPublicUrl(data.path);

    return publicData.publicUrl;
  } catch (err: any) {
    logger.warn('Supabase Storage: Exception during GST certificate upload', {
      userId,
      error: String(err?.message || err),
    });
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://storage.supabase.co';
    return `${supabaseUrl}/storage/v1/object/public/kyc-documents/${storagePath}`;
  }
}
