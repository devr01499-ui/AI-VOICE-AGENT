import React from 'react';
import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="pt-32 px-6 max-w-4xl mx-auto pb-32 bg-background min-h-screen">
      <div className="space-y-4 mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-foreground leading-tight">Privacy Policy</h1>
        <p className="text-sm font-bold text-gray-500 font-mono">Last Updated: July 20, 2026</p>
      </div>

      <div className="prose prose-lg text-gray-600 font-sans text-body leading-relaxed space-y-8 bg-white border border-gray-200 p-10 rounded-3xl shadow-sm">
        <p>
          This Privacy Policy describes how Claritiy Voice Solutions ("Claritiy Voice," "we," "us," or "our") collects, uses, and discloses personal information when you visit www.claritiy.com, interact with our marketing campaigns, communicate with us, engage with us over social media, attend events that we host or sponsor, or use our voice AI Agent Creation platform and related services (collectively, the "Services"), or otherwise interact with us. Claritiy Voice collects and uses personal information in two capacities: (1) for our own business purposes, including operating our website, marketing, sales, and business administration; and (2) as a service provider processing data on behalf of our customers in connection with their use of the Services. Where we process data on behalf of a customer, we will enter into a data processing addendum or similar agreement that governs our processing of personal information on behalf of a customer. By using the Services, you consent to the data practices described in this Privacy Policy.
        </p>

        <p>
          We do not knowingly collect information from children under the age of 16. If we determine that we have collected information from a child under the age of 16, we will delete that information.
        </p>

        <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">1. PERSONAL INFORMATION THAT WE COLLECT</h2>
        <h3 className="text-xl font-bold text-foreground mt-6 mb-3">Information You Provide to Us</h3>
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

        <h3 className="text-xl font-bold text-foreground mt-6 mb-3">AI Communications (Voice and Text Messaging); Call Recording Disclosures</h3>
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

        <div className="mt-12 text-center pt-8 border-t border-gray-200">
          <Link href="/" className="text-emerald-600 font-bold hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
