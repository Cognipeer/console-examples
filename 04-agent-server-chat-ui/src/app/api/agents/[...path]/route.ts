import { createNextRouteHandlers } from "@cognipeer/agent-server";
import { getAgentServer } from "@/lib/agent-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Build the handlers lazily so nothing (and no Console call) happens at `next build` time.
type Handlers = ReturnType<typeof createNextRouteHandlers>;
let handlers: Promise<Handlers> | undefined;
const get = () => (handlers ??= getAgentServer().then(({ server }) => createNextRouteHandlers(server)));

export const GET = async (...a: Parameters<Handlers["GET"]>) => (await get()).GET(...a);
export const POST = async (...a: Parameters<Handlers["POST"]>) => (await get()).POST(...a);
export const PATCH = async (...a: Parameters<Handlers["PATCH"]>) => (await get()).PATCH(...a);
export const DELETE = async (...a: Parameters<Handlers["DELETE"]>) => (await get()).DELETE(...a);
export const OPTIONS = async (...a: Parameters<Handlers["OPTIONS"]>) => (await get()).OPTIONS(...a);
