import WorkspaceCanvas from '@/components/editor/WorkspaceCanvas';
import { SourcePanel } from '@/presentation/SourcePanel';
import { EditorTopBar } from '@/presentation/EditorTopBar';
import { ToolRail } from '@/components/editor/ToolRail';
import { RightPanel } from '@/presentation/RightPanel';
import { useService } from '@/service-core';
import { ImportService } from '@/services/import-service';

export default function App() {
  const images = useService(ImportService);
  return (
    <main
      className="app-shell"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        images.openDroppedFiles(event.dataTransfer.files);
      }}
    >
      <EditorTopBar />
      <SourcePanel />
      <ToolRail />
      <WorkspaceCanvas />
      <RightPanel />
    </main>
  );
}
