import type { FC } from "react";
import { HomeView } from "./home-view";

export const dynamic = "force-dynamic";

const Page: FC<PageProps<"/">> = () => <HomeView />;

export default Page;
