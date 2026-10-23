import { PLAYBOOKS, generatePlaybookPrompt, reviewPromptQuality, PlaybookType } from '../src/utils/playbooks';
import {
  PlaybookTemplateSchema,
  PromptCoachGenerateResponseSchema,
  PromptCoachReviewSchema,
} from '../src/types/promptCoach';

export async function runPromptCoachContractTests() {
  console.log('🧪 RUNNING PROMPT COACH CONTRACT DRIFT TESTS');

  const playbookKeys = Object.keys(PLAYBOOKS) as PlaybookType[];
  if (playbookKeys.length !== 6) {
    throw new Error(`Expected exactly 6 playbooks, found ${playbookKeys.length}`);
  }

  const expectedPlaybooks: PlaybookType[] = [
    'outbound_sales',
    'lead_qualification',
    'inbound_support',
    'appointment_booking',
    'collections_reminder',
    'customer_survey',
  ];

  for (const expectedId of expectedPlaybooks) {
    if (!PLAYBOOKS[expectedId]) {
      throw new Error(`Missing expected playbook: ${expectedId}`);
    }

    const playbook = PLAYBOOKS[expectedId];
    const parseResult = PlaybookTemplateSchema.safeParse(playbook);
    if (!parseResult.success) {
      throw new Error(`Playbook ${expectedId} failed PlaybookTemplateSchema validation: ${JSON.stringify(parseResult.error.errors)}`);
    }

    // Verify mandatory base fields
    const requiredKeys = playbook.requiredFields.map(f => f.key);
    for (const mandatoryKey of ['companyName', 'productOrService', 'agentName']) {
      if (!requiredKeys.includes(mandatoryKey)) {
        throw new Error(`Playbook ${expectedId} missing mandatory requiredField: ${mandatoryKey}`);
      }
    }

    // Verify generatePlaybookPrompt output shape
    const genResult = generatePlaybookPrompt(expectedId, {
      companyName: 'Acme Health',
      productOrService: 'Telehealth Consultations',
      agentName: 'Aria',
      coreProblem: 'Long clinic wait times',
    });

    const genParse = PromptCoachGenerateResponseSchema.safeParse(genResult);
    if (!genParse.success) {
      throw new Error(`generatePlaybookPrompt for ${expectedId} failed response schema: ${JSON.stringify(genParse.error.errors)}`);
    }

    if (!genResult.generatedPrompt || genResult.generatedPrompt.length < 50) {
      throw new Error(`generatePlaybookPrompt for ${expectedId} returned empty or truncated prompt`);
    }

    // Verify review schema fields
    const reviewParse = PromptCoachReviewSchema.safeParse(genResult.review);
    if (!reviewParse.success) {
      throw new Error(`Review object for ${expectedId} failed PromptCoachReviewSchema: ${JSON.stringify(reviewParse.error.errors)}`);
    }

    console.log(`  ✓ Playbook [${expectedId}] passed contract validation`);
  }

  // Verify reviewPromptQuality directly
  const samplePrompt = `
You are Alex, an intelligent voice agent at Apex Logistics.
If asked whether you are an AI, disclose truthfully.
If the customer asks to be removed or is not interested, honor the opt-out immediately.
When customer objects to pricing, explain that manual overhead costs exceed the subscription.
To schedule a briefing, invite them to a 15-minute screen share on Thursday at 3 PM.
`.trim();

  const review = reviewPromptQuality(samplePrompt);
  const reviewValidation = PromptCoachReviewSchema.safeParse(review);
  if (!reviewValidation.success) {
    throw new Error(`reviewPromptQuality failed schema: ${JSON.stringify(reviewValidation.error.errors)}`);
  }

  if (typeof review.score !== 'number' || !review.letterGrade) {
    throw new Error('reviewPromptQuality missing score or letterGrade');
  }

  console.log(`  ✓ reviewPromptQuality verified (Score: ${review.score}, Grade: ${review.letterGrade})`);
  console.log('✅ ALL PROMPT COACH CONTRACT TESTS PASSED (0 DRIFT DETECTED)');
}

if (require.main === module) {
  runPromptCoachContractTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ PROMPT COACH CONTRACT TEST FAILED:', err);
      process.exit(1);
    });
}
