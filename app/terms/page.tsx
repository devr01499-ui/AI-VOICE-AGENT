import React from 'react';
import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="pt-32 px-6 max-w-4xl mx-auto pb-32 bg-background min-h-screen">
      <div className="space-y-4 mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-foreground leading-tight">Terms of Service</h1>
        <p className="text-sm font-bold text-gray-500 font-mono">Last Updated: June 1, 2026</p>
      </div>

      <div className="prose prose-lg text-gray-600 font-sans text-body leading-relaxed space-y-8 bg-white border border-gray-200 p-10 rounded-3xl shadow-sm">
        <p>
          BY CLICKING “I ACCEPT” OR OTHERWISE ACCESSING OR USING THE SERVICE, YOU AGREE THAT YOU HAVE READ AND UNDERSTOOD, AND, AS A CONDITION TO YOUR USE OF THE SERVICE, YOU AGREE TO BE BOUND BY, THE FOLLOWING TERMS.
        </p>

        <p>
          These Terms of Service are an agreement between Claritiy Voice Solutions ("Claritiy Voice," "we," "our," or "us") and the person (natural or legal) ("you," "your," or "Customer") and govern your use of the Claritiy Voice professional and enterprise services ("Services"). Your use of the site and services is conditioned on your acceptance without modification of the terms, conditions, and notices contained herein.
        </p>
        
        <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">5. INDEMNIFICATION</h2>
        <p className="uppercase font-bold text-sm">
          YOU AGREE TO INDEMNIFY, DEFEND, AND HOLD HARMLESS CLARITIY VOICE SOLUTIONS, ITS OFFICERS, DIRECTORS, EMPLOYEES, AGENTS AND THIRD PARTIES, FOR ANY LOSSES, COSTS, LIABILITIES AND EXPENSES (INCLUDING REASONABLE ATTORNEY'S FEES) RELATING TO OR ARISING OUT OF YOUR USE OF OR INABILITY TO USE THE SITE OR SERVICES, ANY USER POSTINGS MADE BY YOU, YOUR VIOLATION OF ANY TERMS OF THIS AGREEMENT OR YOUR VIOLATION OF ANY RIGHTS OF A THIRD PARTY, OR YOUR VIOLATION OF ANY APPLICABLE LAWS, RULES OR REGULATIONS. CLARITIY VOICE SOLUTIONS RESERVES THE RIGHT, AT ITS OWN COST, TO ASSUME THE EXCLUSIVE DEFENSE AND CONTROL OF ANY MATTER OTHERWISE SUBJECT TO INDEMNIFICATION BY YOU, IN WHICH EVENT YOU WILL FULLY COOPERATE WITH CLARITIY VOICE SOLUTIONS IN ASSERTING ANY AVAILABLE DEFENSES.
        </p>
        
        <h2 className="text-2xl font-bold text-foreground mt-8 mb-4">6. LIABILITY DISCLAIMER</h2>
        <p className="uppercase font-bold text-sm">
          THE INFORMATION, SOFTWARE, PRODUCTS, AND SERVICES INCLUDED IN OR AVAILABLE THROUGH THE SITE MAY INCLUDE INACCURACIES OR TYPOGRAPHICAL ERRORS. CHANGES ARE PERIODICALLY ADDED TO THE INFORMATION HEREIN. CLARITIY VOICE SOLUTIONS AND/OR ITS SUPPLIERS MAY MAKE IMPROVEMENTS AND/OR CHANGES IN THE SITE AT ANY TIME.
        </p>
        <p className="uppercase font-bold text-sm">
          CLARITIY VOICE SOLUTIONS MAKES NO REPRESENTATIONS ABOUT THE SUITABILITY, RELIABILITY, AVAILABILITY, TIMELINESS, AND ACCURACY OF THE INFORMATION, SOFTWARE, PRODUCTS, SERVICES AND RELATED GRAPHICS CONTAINED ON THE SITE FOR ANY PURPOSE. TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, ALL SUCH INFORMATION, SOFTWARE, PRODUCTS, SERVICES AND RELATED GRAPHICS ARE PROVIDED "AS IS" WITHOUT WARRANTY OR CONDITION OF ANY KIND.
        </p>
        <p className="uppercase font-bold text-sm">
          TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL CLARITIY VOICE SOLUTIONS BE LIABLE FOR ANY DIRECT, INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER INCLUDING, WITHOUT LIMITATION, DAMAGES FOR LOSS OF USE, DATA OR PROFITS, ARISING OUT OF OR IN ANY WAY CONNECTED WITH THE USE OR PERFORMANCE OF THE SITE, WITH THE DELAY OR INABILITY TO USE THE SITE OR RELATED SERVICES.
        </p>
        
        <div className="mt-12 text-center pt-8 border-t border-gray-200">
          <Link href="/" className="text-emerald-600 font-bold hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
