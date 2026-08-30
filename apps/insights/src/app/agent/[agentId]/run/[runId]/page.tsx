import { RunReportView } from "./report-view";

const Page = async (props: PageProps<"/agent/[agentId]/run/[runId]">) => {
  const { agentId, runId } = await props.params;
  return <RunReportView agentId={agentId} runId={runId} />;
};

export default Page;
