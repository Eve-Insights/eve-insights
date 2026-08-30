import { getDatabase } from "@/lib/database";
import { handleBeginEvent } from "@/lib/database/handlers";

export const runtime = "nodejs";

const POST = async (
  request: Request,
  context: RouteContext<"/api/v1/runs/[runId]/events">,
): Promise<Response> => {
  const { runId } = await context.params;
  return handleBeginEvent(request, runId, getDatabase);
};

export { POST };
