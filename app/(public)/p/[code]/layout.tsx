import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { programFromParams, programTitle } from "./program";

type Props = { children: React.ReactNode; params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  return { title: programTitle(await programFromParams((await params).code)) };
}

export default async function ProgramLayout({ children, params }: Props) {
  const program = await programFromParams((await params).code);
  return (
    <>
      <SiteHeader program={program} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </>
  );
}
