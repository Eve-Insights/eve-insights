import { getDatabase } from "@/lib/database";
import { handleCommitEvent } from "@/lib/database/handlers";

export const runtime = "nodejs";

const POST = async (
  request: Request,
  context: RouteContext<"/api/v1/runs/[runId]/events/[eventId]/commit">,
): Promise<Response> => {
  const { runId, eventId } = await context.params;
  return handleCommitEvent(request, runId, eventId, getDatabase);
};

export { POST };
