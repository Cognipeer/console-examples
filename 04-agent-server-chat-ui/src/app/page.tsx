import { getAgentServer } from "@/lib/agent-server";
import ChatClient from "./chat-client";

export const dynamic = "force-dynamic"; // reads env at request time, never at build time

export default async function Page() {
  const { agentId } = await getAgentServer();
  return <ChatClient agentId={agentId} />;
}
