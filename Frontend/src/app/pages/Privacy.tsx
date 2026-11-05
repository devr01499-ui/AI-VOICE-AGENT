export default function Privacy() {
  return (
    <div className="pt-32 px-6 max-w-4xl mx-auto pb-32 bg-[#E5E3DC] min-h-screen text-[#262523] font-sans">
      <div className="space-y-4 mb-12">
        <span className="text-xs font-bold text-[#121212] uppercase tracking-wider bg-[#DFDCD4] border border-[#CBC8BE] px-3 py-1 rounded-[2px] font-mono">
          ATTORNEY-GRADE PRIVACY POLICY
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold text-[#121212] leading-tight">Privacy Policy</h1>
        <p className="text-xs font-bold text-[#5E5D57] font-mono">Last Updated: July 20, 2026</p>
      </div>

      <div className="prose prose-lg text-[#262523] text-sm md:text-base leading-relaxed space-y-8 bg-[#EBE9E2] border border-[#CBC8BE] p-8 md:p-12 rounded-[2px]">
        <p>
          This Privacy Policy describes how Claritiy Voice Solutions ("Claritiy Voice," "we," "us," or "our") collects, uses, and discloses personal information when you visit www.claritiy.com, interact with our marketing campaigns, communicate with us, engage with us over social media, attend events that we host or sponsor, or use our voice AI Agent Creation platform and related services (collectively, the "Services"), or otherwise interact with us. Claritiy Voice collects and uses personal information in two capacities: (1) for our own business purposes, including operating our website, marketing, sales, and business administration; and (2) as a service provider processing data on behalf of our customers in connection with their use of the Services. Where we process data on behalf of a customer, we will enter into a data processing addendum or similar agreement that governs our processing of personal information on behalf of a customer. By using the Services, you consent to the data practices described in this Privacy Policy.
        </p>

        <p>
          We do not knowingly collect information from children under the age of 16. If we determine that we have collected information from a child under the age of 16, we will delete that information.
        </p>

        <h2 className="font-sora text-2xl font-bold text-ink mt-8 mb-4">1. PERSONAL INFORMATION THAT WE COLLECT</h2>
        <h3 className="font-sora text-xl font-bold text-ink mt-6 mb-3">Information You Provide to Us</h3>
        <p>
          In order to better provide you with products and services offered, Claritiy Voice may ask you to provide certain personally identifiable information that can be used to contact or identify you. The kinds of personal information you may provide to us includes, but is not limited to:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Email address</li>
          <li>First name and last name</li>
          <li>Government ID, business registration, physical address, tax ID, and authorized representative verification</li>
          <li>Phone number</li>
          <li>Address, State, Province, ZIP/Postal code, City</li>
          <li>Company or organization name</li>
          <li>Job title</li>
          <li>Payment and billing information</li>
          <li>Customer account information</li>
          <li>Customer content, feedback, surveys or questionnaires</li>
          <li>Customer and prospective customer emails and communications (including recorded calls and AI generated transcripts of customer or prospective customer communications)</li>
        </ul>
        <p>
          We collect this information when you provide it to us (for example, when you register to use the Service, contact us, or fill out forms).
        </p>

        <h3 className="font-sora text-xl font-bold text-ink mt-6 mb-3">Google Account &amp; Google Calendar Integration</h3>
        <p>
          Claritiy Voice Solutions (&quot;Claritiy Voice,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) enables users to connect their Google Calendar to allow our voice AI agents to check availability and schedule requested appointments on their behalf during live telephone conversations, as well as using Google Sign-In (OAuth 2.0) for account authentication.
        </p>

        <h4 className="font-sora text-lg font-bold text-ink mt-4 mb-2">What Google Data We Access</h4>
        <p>
          Depending on your interactions and explicitly granted permissions, we request access to the following Google user data:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Profile &amp; Identity:</strong> Your name, email address, and profile avatar solely for authentication and account management.</li>
          <li><strong>Free/Busy Availability (<code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">https://www.googleapis.com/auth/calendar.freebusy</code>):</strong> Used strictly to read busy/free time intervals during live voice calls to compute available meeting slots and prevent double-booking. Claritiy Voice does NOT inspect, read, or process personal event titles, notes, descriptions, or private invitee details of your existing personal events.</li>
          <li><strong>Event Scheduling (<code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">https://www.googleapis.com/auth/calendar.events</code>):</strong> Used solely to insert, reschedule, or cancel appointment events requested by callers on your behalf during live voice conversations.</li>
        </ul>
        <p className="mt-2">
          We do not request access to any unrelated Google services, including Gmail, Google Drive, Google Photos, or Google Contacts.
        </p>

        <h4 className="font-sora text-lg font-bold text-ink mt-4 mb-2">How We Use Google Calendar Data</h4>
        <p>
          We use Google user and calendar data only for the following legitimate purposes:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Authentication &amp; Account Setup:</strong> Verifying your identity and creating your workspace account.</li>
          <li><strong>Real-Time Slot Computation:</strong> Computing free appointment windows dynamically during voice calls.</li>
          <li><strong>Automated Booking:</strong> Scheduling confirmed appointments with caller details and sending calendar invitations.</li>
        </ul>

        <h4 className="font-sora text-lg font-bold text-ink mt-4 mb-2">AI Model Training Prohibition</h4>
        <p className="font-semibold text-ink">
          Claritiy Voice explicitly guarantees that user data obtained through Google Calendar OAuth scopes is NEVER used to train, retrain, fine-tune, or improve generalized artificial intelligence or machine learning models.
        </p>

        <h4 className="font-sora text-lg font-bold text-ink mt-4 mb-2">Storage, Encryption &amp; Retention</h4>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Encryption at Rest:</strong> All Google OAuth access and refresh tokens are encrypted at rest using AES-256-GCM authenticated encryption (<code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">v2:...</code>).</li>
          <li><strong>Transient In-Memory Caching:</strong> Free/busy query responses are cached in volatile memory for at most 30 seconds to prevent rate-limit throttling and are never written to permanent disk.</li>
          <li><strong>Token Retention &amp; Deletion:</strong> Stored tokens are retained only as long as your calendar integration remains active. You may disconnect at any time.</li>
        </ul>

        <h4 className="font-sora text-lg font-bold text-ink mt-4 mb-2">Disconnection &amp; Revocation</h4>
        <p>
          You can disconnect Google Calendar at any time directly in your dashboard under <strong>Settings &gt; Integrations</strong>. Upon disconnection, Claritiy Voice immediately calls Google&apos;s OAuth revocation endpoint (<code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">https://oauth2.googleapis.com/revoke</code>) to permanently invalidate the token and purges all stored tokens from our database. You can also revoke access at any time via your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-mint-primary hover:underline">Google Account Permissions</a>.
        </p>

        <h4 className="font-sora text-lg font-bold text-ink mt-4 mb-2">Google Limited Use Compliance</h4>
        <p className="font-medium text-ink">
          Claritiy Voice&apos;s use and transfer to any other app of information received from Google APIs will adhere to the <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-mint-primary hover:underline">Google API Services User Data Policy</a>, including the Limited Use requirements.
        </p>
        <ul className="list-disc pl-6 space-y-2 mt-2">
          <li>We use Google user data only to provide customer-facing scheduling and authentication features.</li>
          <li>We do not sell, rent, or transfer Google user data to third parties.</li>
          <li>We do not use Google user data for advertising or marketing purposes.</li>
          <li>We do not allow human staff access to your calendar data unless explicitly authorized by you for technical troubleshooting.</li>
        </ul>

        <h4 className="font-sora text-lg font-bold text-ink mt-4 mb-2">Your Rights Regarding Google Data</h4>
        <p>
          You have the right to:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Access:</strong> Request a copy of the Google data we hold about you.</li>
          <li><strong>Delete:</strong> Request deletion of your Google data at any time by deleting your Claritiy Voice account.</li>
          <li><strong>Revoke Access:</strong> Revoke Claritiy Voice&apos;s access to your Google account at any time via <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-mint-primary hover:underline">Google Account Permissions</a>.</li>
          <li><strong>Withdraw Consent:</strong> Withdraw consent for data processing at any time.</li>
        </ul>
        <p>
          To exercise these rights, contact us at <a href="mailto:privacy@claritiy.com" className="text-mint-primary hover:underline">privacy@claritiy.com</a>.
        </p>

        <h4 className="font-sora text-lg font-bold text-ink mt-4 mb-2">Future Expansions of Google Data Access</h4>
        <p>
          If in the future we expand our use of Google services to include additional scopes beyond authentication and calendar scheduling (such as Google Drive or Sheets), we will:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Update this Privacy Policy to reflect the new data access</li>
          <li>Notify you via email or in-app notification</li>
          <li>Seek your explicit consent before accessing any new Google data</li>
          <li>Comply with all applicable Google API policies and verification requirements</li>
        </ul>

        <h3 className="font-sora text-xl font-bold text-ink mt-6 mb-3">AI Communications (Voice and Text Messaging); Call Recording Disclosures</h3>
        <p>
          When our customers purchase our Services, we may collect the following types of data ("Communications Data") from our Customers and their end users, including but not limited to:
        </p>
        <p>
          Our Services may record, transcribe, or otherwise process voice interactions between our customers' AI agents and their end users. Claritiy Voice may also record or monitor calls for quality assurance, safety, security, and service improvement purposes. Where Claritiy Voice initiates recording for its own purposes, we will provide notice as required by applicable law.
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>Audio recordings of voice interactions</li>
          <li>Call transcripts and conversation summaries</li>
          <li>Call and text message metadata (e.g., date, time, duration, phone number, delivery status)</li>
          <li>Telephony data (e.g., carrier information, connection details, routing information)</li>
          <li>Interaction logs (e.g., agent responses, user inputs, and conversation flow)</li>
          <li>Content or data transmitted through the Services by you or your end users</li>
          <li>Source and destination location of the device generated in the context of delivering the communication</li>
          <li>Error data and traffic records</li>
          <li>Device IP address and device information</li>
        </ul>

        <h3 className="font-sora text-xl font-bold text-ink mt-6 mb-3">Automatically Collected Information</h3>
        <p>
          Additionally, whether you visit our Service, receive communications from our customers, we automatically collect certain kinds of personal information via cookies or other tracking technologies. The type of information that we automatically collect via tracking technologies includes:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li>IP address and general location information (e.g., city or region)</li>
          <li>Unique identifiers</li>
          <li>Browser type and version, time zone setting, and language preferences</li>
          <li>Device information (e.g., device type, operating system, unique device identifiers, manufacturer, model, diagnostic data and screen resolution)</li>
          <li>Pages visited, features used, products viewed or searched for, and the date, time, and duration of your activity</li>
          <li>Referring and exit URLs, clickstream data, and page interaction information (e.g., scrolling, clicks, and mouse movements)</li>
          <li>API request logs and server log data</li>
          <li>Page response times, download errors, and other diagnostic information</li>
        </ul>
        <p>
          We collect this information through cookies, web beacons, pixels, server logs, and similar tracking technologies. This information is collected whether you access our website, or the Services via a desktop browser, mobile device, or API integration. We also collect this information when you open emails from us. We do not collect precise geolocation information.
        </p>
        <p>Examples of cookies we use:</p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Session Cookies:</strong> These are temporary cookies that expire when you close your browser. We use session cookies to maintain your session state, authenticate your identity, and enable core functionality as you navigate the Service.</li>
          <li><strong>Preference Cookies:</strong> These cookies allow our Service to remember choices you make (such as language, region, or display settings) and provide a more personalized experience. They may also be used to remember changes you have made to customizable parts of the Service.</li>
          <li><strong>Security Cookies:</strong> These cookies help detect and prevent security risks, such as unauthorized access, fraud, and abuse. They support authentication, protect against cross-site request forgery, and help us maintain the integrity of our Service.</li>
          <li><strong>Advertising and Social Media Cookies:</strong> These cookies are placed by us or third-party advertising and social media partners to deliver advertisements that may be relevant to you and your interests, limit the number of times you see an advertisement, and measure the effectiveness of advertising campaigns. They may also enable social media features such as content sharing and social login.</li>
        </ul>

        <h3 className="font-sora text-xl font-bold text-ink mt-6 mb-3">Information we Receive from Third Parties</h3>
        <p>
          We may receive personal information about you from third-party sources and combine it with information we already hold. The types of third-party sources and information we may receive include, but are not limited to:
        </p>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Telecommunications providers and carriers:</strong> carrier name and type, phone number validation and portability data, SIM status, routing information, call delivery status, and error or traffic records.</li>
          <li><strong>Communications platform providers (e.g., Twilio):</strong> call and message metadata, delivery and connection status, source and destination information, and other data generated in the course of routing and delivering communications through the Services.</li>
          <li><strong>Analytics and advertising partners:</strong> information about your interactions with our advertisements or marketing campaigns on third-party platforms, including conversion events, click and impression data, and advertising identifiers.</li>
          <li><strong>Social media platforms:</strong> information you make available through your social media accounts when you interact with our pages or content, or use social login features, in accordance with your privacy settings on those platforms.</li>
          <li><strong>Business intelligence data providers:</strong> professional and company information such as your employer, job title, industry, company size, and business contact details, which we may use for sales, marketing, and lead generation purposes.</li>
          <li><strong>Payment processors:</strong> billing verification data and transaction status information related to your use of paid Services.</li>
        </ul>

        <h3 className="font-sora text-xl font-bold text-ink mt-6 mb-3">5. Integration and Connector Data</h3>
        <p>
          When you access or use the Services through a third-party client or integration, including our Model [TEXT TRUNCATED HERE; PLEASE PROVIDE THE REMAINDER OF THE POLICY TO COMPLETE THIS SECTION]
        </p>
      </div>
    </div>
  );
}
