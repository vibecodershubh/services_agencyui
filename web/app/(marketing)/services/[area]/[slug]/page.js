import { ServiceDetail } from "../../../../../components/ServiceView";

export default async function ServicePage({ params }) { const { slug } = await params; return <ServiceDetail slug={slug} />; }
