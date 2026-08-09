import { google, searchconsole_v1 } from 'googleapis';

let gscClient: searchconsole_v1.Searchconsole | null = null;

export async function getGscClient() {
  if (gscClient) return gscClient;

  // Assuming GOOGLE_APPLICATION_CREDENTIALS points to a service account JSON file
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS environment variable is required.");
  }

  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/webmasters'],
  });

  const authClient = await auth.getClient();
  // @ts-expect-error - upstream bug: googleapis GlobalOptions expects OAuth2Client but GoogleAuth.getClient() returns a union of other clients (https://github.com/googleapis/google-api-nodejs-client/issues/2920)
  google.options({ auth: authClient });

  gscClient = google.searchconsole('v1');
  return gscClient;
}

export async function submitToIndexingApi(url: string) {
  // Uses the Indexing API for rapid submission
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/indexing'],
  });
  const authClient = await auth.getClient();
  
  const indexing = google.indexing('v3');
  // @ts-expect-error - upstream bug: googleapis GlobalOptions expects OAuth2Client but GoogleAuth.getClient() returns a union of other clients (https://github.com/googleapis/google-api-nodejs-client/issues/2920)
  google.options({ auth: authClient });
  
  try {
    await indexing.urlNotifications.publish({
      requestBody: {
        url: url,
        type: 'URL_UPDATED',
      }
    });
    console.log(`Successfully submitted ${url} to Indexing API.`);
  } catch (error) {
    console.error(`Failed to submit ${url} to Indexing API`, error);
  }
}

export async function fetchGscPerformanceData(siteUrl: string, startDate: string, endDate: string) {
  const client = await getGscClient();
  const response = await client.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: ['page'],
    },
  });
  return response.data.rows || [];
}
