import { AgentRunsView } from "./runs-view";

const Page = async (props: PageProps<"/agent/[agentId]/runs">) => {
  const { agentId } = await props.params;
  return <AgentRunsView agentId={agentId} />;
};

export default Page;
