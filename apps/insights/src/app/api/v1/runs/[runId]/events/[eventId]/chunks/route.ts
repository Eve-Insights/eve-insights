import { getDatabase } from "@/lib/database";
import { handleWriteEventChunk } from "@/lib/database/handlers";

export const runtime = "nodejs";

const POST = async (
  request: Request,
  context: RouteContext<"/api/v1/runs/[runId]/events/[eventId]/chunks">,
): Promise<Response> => {
  const { runId, eventId } = await context.params;
  return handleWriteEventChunk(request, runId, eventId, getDatabase);
};

export { POST };
