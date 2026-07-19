import { zodTextFormat } from "openai/helpers/zod";
import { analysisRequestSchema, analysisResponseSchema, maskSensitiveInformation } from "../../lib/domain";
import { getLiveAIConfiguration, getOpenAIClient, missingKeyResponse, runOnce, safeApiErrorResponse } from "../../lib/openai-server";

export const runtime = "nodejs";

const analysisInstructions = `You are CallLens Coach, a senior contact-center QA manager and evidence-based coach.
Analyze the supplied conversation in its original language. Support English, Arabic, and code-switching, with particular care for Egyptian, Gulf, Levantine, and Modern Standard Arabic. Interpret indirect complaints, reassurance, culturally appropriate tone, and expressions contextually. Preserve Arabic quotes exactly.

Score only what the transcript supports. Apply the supplied scorecard weights when deciding the overall score, while returning every required standard category score. Every finding must cite verbatim evidence. Never invent timestamps: when timestamps are absent, use Opening, Early call, Middle of call, Late call, or Closing. Treat supplied speaker mappings and audio metrics as deterministic application context: use them when relevant, but do not alter their values or present them as AI estimates. Rewrite only weak agent responses in the improved conversation and preserve the customer's meaning. The estimated revised score is a cautious estimate, not a guarantee. Return empty arrays when a finding type is not present; do not manufacture issues to fill sections.`;

// Speaker mappings and audio metrics are deterministic application context. The model may
// interpret them for coaching, but must not rewrite their values or treat them as AI estimates.

export async function POST(request: Request) {
  const configuration = getLiveAIConfiguration();
  if (!configuration.configured) return missingKeyResponse();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "invalid_json", message: "The analysis request was not valid JSON." } }, { status: 400 });
  }

  const parsed = analysisRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_request", message: "Check the transcript, call details, and QA scorecard weights." } }, { status: 400 });
  }

  const privacy = maskSensitiveInformation(parsed.data.transcript, parsed.data.maskSensitiveInformation);
  const client = getOpenAIClient();
  if (!client) return missingKeyResponse();

  try {
    const result = await runOnce(request.headers.get("x-calllens-request-id"), async () => {
      const response = await client.responses.parse({
        model: configuration.analysisModel,
        store: false,
        reasoning: { effort: "low" },
        input: [
          { role: "developer", content: analysisInstructions },
          {
            role: "user",
            content: JSON.stringify({ ...parsed.data, transcript: privacy.transcript }),
          },
        ],
        text: { format: zodTextFormat(analysisResponseSchema, "call_quality_analysis") },
      });
      const validated = analysisResponseSchema.safeParse(response.output_parsed);
      if (!validated.success) throw new Error("invalid_structured_output");
      return validated.data;
    });

    if (result.duplicate) {
      return Response.json({ error: { code: "duplicate_submission", message: "This analysis is already in progress." } }, { status: 409 });
    }
    return Response.json({ analysis: result.value, privacy: privacy.summary });
  } catch (error) {
    return safeApiErrorResponse(error);
  }
}
