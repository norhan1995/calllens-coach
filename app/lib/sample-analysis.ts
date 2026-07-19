import type { AnalysisResponse, PrivacySummary } from "./domain.ts";

const billingEvidence = {
  quote: "I can see why a duplicate charge would be upsetting.",
  speaker: "Agent" as const,
  explanation: "The agent names the problem and validates the emotional impact.",
  timestamp: "Early call",
  category: "empathy" as const,
};

export const SAMPLE_ANALYSIS: AnalysisResponse = {
  overallScore: 88,
  greetingScore: 94,
  needsDiscoveryScore: 82,
  empathyScore: 91,
  accuracyScore: 88,
  objectionHandlingScore: 76,
  callControlScore: 86,
  closingScore: 90,
  complianceScore: 96,
  detectedLanguage: "English with a Gulf Arabic expression",
  detectedDialect: "Mixed Arabic and English — Gulf Arabic influence",
  customerSentiment: "Frustrated → reassured",
  customerIntent: "Resolve a duplicate billing charge and prevent recurrence",
  executiveSummary: "Maya delivered a calm, accurate resolution and reduced the customer's frustration. The strongest moments were her specific empathy and clear next step. The call would improve with complete identity verification and one additional discovery question before discussing billing activity.",
  strengths: [
    { title: "Specific empathy reduced tension", detail: "The response connected directly to the customer's stated concern instead of using a generic apology.", evidence: [billingEvidence] },
    { title: "Clear ownership and next step", detail: "The agent explained when the authorization should clear and offered a concrete follow-up path.", evidence: [{ quote: "If the pending charge remains after three business days, reply to my email and we’ll reverse it immediately.", speaker: "Agent", explanation: "A timeframe and escalation path make the resolution actionable.", timestamp: "Late call", category: "accuracy" }] },
  ],
  mistakes: [{ title: "Contact channel was assumed", detail: "The agent sent an email without confirming that it was the customer's preferred channel.", evidence: [{ quote: "I’ll also send you a confirmation email now.", speaker: "Agent", explanation: "Confirming the channel would create a clearer, customer-led close.", timestamp: "Middle of call", category: "callControl" }] }],
  complianceWarnings: [{ title: "Account verification was incomplete", detail: "Only one account detail was confirmed before billing activity was discussed.", evidence: [{ quote: "May I confirm the last four digits of your phone number?", speaker: "Agent", explanation: "The sample scorecard expects the full approved verification sequence.", timestamp: "Early call", category: "compliance" }] }],
  missedOpportunities: [{ title: "One more discovery question", detail: "A question about recent plan or payment changes could have identified the trigger and reduced repeat contact.", evidence: [{ quote: "I found both charges.", speaker: "Agent", explanation: "The agent moved directly to explanation without checking for a recent account change.", timestamp: "Middle of call", category: "needsDiscovery" }] }],
  coachingRecommendations: [
    { title: "Verify before account discussion", detail: "Use the complete identity check required by the active scorecard before sharing billing details.", evidence: [{ quote: "May I confirm the last four digits of your phone number?", speaker: "Agent", explanation: "This is a useful start, but the approved verification flow requires another identifier.", timestamp: "Early call", category: "compliance" }] },
    { title: "Add a focused discovery question", detail: "Ask whether the customer recently changed a plan or payment method before finalizing the explanation.", evidence: [{ quote: "I need to know this won’t happen again.", speaker: "Customer", explanation: "The customer explicitly signals a prevention goal that deserves a diagnostic follow-up.", timestamp: "Late call", category: "needsDiscovery" }] },
  ],
  improvedPhrases: [{ original: "One is a temporary authorization and should disappear.", improved: "I found the duplicate amount. One charge is a temporary authorization, and it should clear within three business days. If it does not, I’ll help you reverse it immediately.", explanation: "The revised response adds a precise timeframe and clear ownership.", category: "accuracy", evidence: { quote: "One is a temporary authorization and should disappear within three business days.", speaker: "Agent", explanation: "The original is accurate but can make the ownership and contingency clearer.", timestamp: "Middle of call", category: "accuracy" } }],
  customerFollowUpMessage: "Hi Jordan, thank you for speaking with us today. I confirmed that the second charge is a temporary authorization and should clear within three business days. If it remains after that, reply to this message and we’ll resolve it right away. — Maya, Northstar Mobile",
  confidenceScore: 93,
  dialectInsight: { detectedDialect: "Gulf Arabic influence in an English-dominant call", detectedCodeSwitching: true, importantExpression: "أبشر، I’ll check that for you.", literalInterpretation: "Receive good news / consider it done.", contextualInterpretation: "A warm Gulf expression signaling reassurance and immediate willingness to help.", qaImportance: "Used naturally, it can build rapport. The agent should still pair it with a specific action so reassurance does not sound vague." },
  criticalMoments: [
    { position: "Opening", speaker: "Agent", eventType: "strong moment", title: "Professional welcome", evidenceQuote: "Thank you for calling Northstar Mobile. My name is Maya.", explanation: "The agent identifies the organization and herself before inviting the customer to explain.", suggestedResponse: null },
    { position: "Early call", speaker: "Customer", eventType: "frustration", title: "Duplicate-charge frustration", evidenceQuote: "I was charged twice for my monthly plan and I’m really frustrated.", explanation: "The customer states both the transactional problem and its emotional impact.", suggestedResponse: "I’m sorry this happened. I can see why two charges would be worrying, and I’ll check both with you now." },
    { position: "Early call", speaker: "Agent", eventType: "empathy", title: "Specific acknowledgment", evidenceQuote: billingEvidence.quote, explanation: billingEvidence.explanation, suggestedResponse: null },
    { position: "Middle of call", speaker: "Agent", eventType: "compliance risk", title: "Verification gap", evidenceQuote: "May I confirm the last four digits of your phone number?", explanation: "The agent begins verification but does not complete the approved sequence before discussing charges.", suggestedResponse: "Before I review the charges, may I also verify your full name on the account?" },
    { position: "Closing", speaker: "Agent", eventType: "successful recovery", title: "Clear contingency path", evidenceQuote: "If the pending charge remains after three business days, reply to my email and we’ll reverse it immediately.", explanation: "The call closes with a timeframe, channel, and next action.", suggestedResponse: null },
  ],
  improvedConversation: [
    { position: "Early call", originalAgentResponse: "May I confirm the last four digits of your phone number?", improvedAgentResponse: "Before I review the charges, may I verify your full name and the last four digits of the phone number on the account?", explanation: "Completes the identity check before account-level disclosure.", category: "compliance" },
    { position: "Middle of call", originalAgentResponse: "I found both charges. One is a temporary authorization.", improvedAgentResponse: "I found both charges. Before I explain them, have you recently changed your plan or payment method?", explanation: "Adds a targeted diagnostic question without changing the customer's meaning.", category: "needsDiscovery" },
  ],
  estimatedRevisedScore: 94,
  sevenDayCoachingPlan: [
    { day: 1, focus: "Verification", action: "Review the approved identity-check sequence.", successMeasure: "Complete the sequence correctly in five practice openings." },
    { day: 2, focus: "Discovery", action: "Write three focused follow-up questions for billing contacts.", successMeasure: "Each question links to a likely root cause." },
    { day: 3, focus: "Role-play", action: "Practice an angry billing scenario at intermediate difficulty.", successMeasure: "Verify before disclosure and ask one diagnostic question." },
    { day: 4, focus: "Language", action: "Pair warm reassurance with one concrete action and timeframe.", successMeasure: "Use the pattern in three mock responses." },
    { day: 5, focus: "Closing", action: "Confirm the customer's preferred follow-up channel.", successMeasure: "Include channel confirmation in five closing scripts." },
    { day: 6, focus: "Self-review", action: "Review two calls and tag evidence for compliance and discovery.", successMeasure: "Every tag includes a verbatim quote." },
    { day: 7, focus: "Reassessment", action: "Repeat the billing role-play and compare category scores.", successMeasure: "Reach at least 90 in compliance and needs discovery." },
  ],
};

export const SAMPLE_PRIVACY: PrivacySummary = { detectedCount: 2, maskedCount: 2, types: ["phone", "account number"] };
