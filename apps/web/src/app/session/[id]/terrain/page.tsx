import { FieldModeView } from "./field-mode-view";

export default async function FieldModePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FieldModeView sessionId={id} />;
}
