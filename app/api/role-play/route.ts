import { zodTextFormat } from "openai/helpers/zod";
import { rolePlayRequestSchema, rolePlayResponseSchema } from "../../lib/domain";
import { getLiveAIConfiguration, getOpenAIClient, missingKeyResponse, runOnce, safeApiErrorResponse } from "../../lib/openai-server";

export const runtime = "nodejs";

const rolePlayInstructions = `You are the customer in a contact-center coaching role-play and an evidence-based coach when feedback is requested.
Stay inside the selected scenario, mood, difficulty, language, and Arabic dialect. During start/respond actions, reply as the customer and continue naturally without coaching the agent. During feedback/end actions, assess the agent's actual replies, give specific coaching, and never invent an analyzed-call comparison when no baseline score was supplied. Keep Arabic dialect and code-switching natural and culturally appropriate.`;

export async function POST(request: Request) {
  const configuration = getLiveAIConfiguration();
  if (!configuration.configured) return missingKeyResponse();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: { code: "invalid_json", message: "The role-play request was not valid JSON." } }, { status: 400 });
  }
  const parsed = rolePlayRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_request", message: "Complete the role-play setup and try again." } }, { status: 400 });
  }
  const client = getOpenAIClient();
  if (!client) return missingKeyResponse();

  try {
    const result = await runOnce(request.headers.get("x-calllens-request-id"), async () => {
      const response = await client.responses.parse({
        model: configuration.analysisModel,
        store: false,
        reasoning: { effort: "low" },
        input: [
          { role: "developer", content: rolePlayInstructions },
          { role: "user", content: JSON.stringify(parsed.data) },
        ],
        text: { format: zodTextFormat(rolePlayResponseSchema, "role_play_coaching") },
      });
      const validated = rolePlayResponseSchema.safeParse(response.output_parsed);
      if (!validated.success) throw new Error("invalid_structured_output");
      return validated.data;
    });
    if (result.duplicate) {
      return Response.json({ error: { code: "duplicate_submission", message: "This role-play turn is already in progress." } }, { status: 409 });
    }
    return Response.json({ rolePlay: result.value });
  } catch (error) {
    return safeApiErrorResponse(error);
  }
}
