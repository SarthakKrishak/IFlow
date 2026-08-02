"use client";

import dynamic from "next/dynamic";

const WikiEditor = dynamic(() => import("./WikiEditor"), { ssr: false });

export default function WikiEditorWrapper(props: any) {
  return <WikiEditor {...props} />;
}
