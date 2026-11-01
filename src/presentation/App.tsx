import WorkspaceCanvas from '@/components/editor/WorkspaceCanvas';
import { SourcePanel } from '@/presentation/SourcePanel';
import { EditorTopBar } from '@/presentation/EditorTopBar';
import { ToolRail } from '@/components/editor/ToolRail';
import { RightPanel } from '@/presentation/RightPanel';
import { useService } from '@/service-core';
import { ImageImportService } from '@/services/image-import-service';

export default function App() {
  const images = useService(ImageImportService);
  return (
    <main
      className="app-shell"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = [...event.dataTransfer.files].find((item) => item.type.startsWith('image/'));
        if (file) images.openImage(file);
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
