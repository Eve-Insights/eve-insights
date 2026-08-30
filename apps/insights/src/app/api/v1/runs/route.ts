import { getDatabase } from "@/lib/database";
import { handleCreateRun } from "@/lib/database/handlers";

export const runtime = "nodejs";

const POST = async (request: Request): Promise<Response> => {
  return handleCreateRun(request, getDatabase);
};

export { POST };
