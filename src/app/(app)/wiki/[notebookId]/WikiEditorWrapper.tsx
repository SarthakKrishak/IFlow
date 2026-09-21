"use client";

import dynamic from "next/dynamic";
import { EditorSkeleton } from "@/components/shared/Skeletons";

const WikiEditor = dynamic(() => import("./WikiEditor"), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

export default function WikiEditorWrapper(props: any) {
  return <WikiEditor {...props} />;
}
