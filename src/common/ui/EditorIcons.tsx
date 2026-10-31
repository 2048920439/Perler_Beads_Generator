import type { ArrowKind, ShapeKind, ToolId } from '@/common/types';

export function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 4.5v11" />
      <path d="M4.5 10h11" />
    </svg>
  );
}

export function UndoIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7.5 4.5 4 8l3.5 3.5" />
      <path d="M4 8h7.2a4 4 0 0 1 0 8H8.6" />
    </svg>
  );
}

export function RedoIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M12.5 4.5 16 8l-3.5 3.5" />
      <path d="M16 8H8.8a4 4 0 0 0 0 8h2.6" />
    </svg>
  );
}

export function ExportIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 3v9" />
      <path d="m6.8 8.8 3.2 3.2 3.2-3.2" />
      <path d="M4 13.2v2.6c0 .7.5 1.2 1.2 1.2h9.6c.7 0 1.2-.5 1.2-1.2v-2.6" />
    </svg>
  );
}

export function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5a9.5 9.5 0 0 0-3 18.5c.48.08.66-.2.66-.46v-1.7c-2.68.58-3.25-1.14-3.25-1.14-.44-1.1-1.07-1.4-1.07-1.4-.88-.6.07-.58.07-.58.97.07 1.48 1 1.48 1 .86 1.47 2.25 1.04 2.8.8.09-.62.34-1.04.61-1.28-2.14-.24-4.39-1.07-4.39-4.76 0-1.05.38-1.91 1-2.58-.1-.25-.43-1.24.1-2.55 0 0 .81-.26 2.66.99a9.16 9.16 0 0 1 4.84 0c1.85-1.25 2.66-.99 2.66-.99.53 1.31.2 2.3.1 2.55.62.67 1 1.53 1 2.58 0 3.7-2.26 4.51-4.4 4.75.35.3.66.9.66 1.81v2.5c0 .26.17.55.67.46A9.5 9.5 0 0 0 12 2.5z" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6 6l8 8" />
      <path d="M14 6l-8 8" />
    </svg>
  );
}
export function LockIcon({ locked }: { locked: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5.5" y="10" width="13" height="10" rx="2" />
      <path d={locked ? 'M8.5 10V7.7a3.5 3.5 0 017 0V10' : 'M8.5 10V7.7a3.5 3.5 0 016.4-2'} />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20l4.6-1 9.8-9.8-3.6-3.6L5 15.4 4 20z" />
      <path d="M13.8 4.6l1.5-1.5c.7-.7 1.8-.7 2.5 0l1.1 1.1c.7.7.7 1.8 0 2.5l-1.5 1.5" />
    </svg>
  );
}

export function DuplicateIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M5 16V6.8C5 5.8 5.8 5 6.8 5H16" />
    </svg>
  );
}

export function DragHandleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5h.1M15 5h.1M9 12h.1M15 12h.1M9 19h.1M15 19h.1" />
    </svg>
  );
}

export function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2.8 12s3.3-5.5 9.2-5.5 9.2 5.5 9.2 5.5-3.3 5.5-9.2 5.5S2.8 12 2.8 12z" />
      <circle cx="12" cy="12" r="2.5" />
      {!visible && <path d="M4 4l16 16" />}
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16" />
      <path d="M9 7V4.8h6V7" />
      <path d="M7 7l.8 13h8.4L17 7" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}

export function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 11a7.5 7.5 0 1 1 2.2 5.3" />
      <path d="M4.5 5.5V11h5.5" />
    </svg>
  );
}

export function ToolIcon({ tool }: { tool: ToolId }) {
  if (tool === 'pencil') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20l4.7-1 9.8-9.8-3.7-3.7L5 15.3 4 20z" />
        <path d="M13.8 4.5l1.7-1.7c.7-.7 1.8-.7 2.5 0l1.2 1.2c.7.7.7 1.8 0 2.5l-1.7 1.7" />
      </svg>
    );
  }
  if (tool === 'eraser') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.3 14.6l7.9-7.9c.8-.8 2-.8 2.8 0l4.3 4.3c.8.8.8 2 0 2.8l-5.9 5.9H8.6l-4.3-4.3c-.2-.2-.2-.6 0-.8z" />
        <path d="M9.8 19.7h10" />
      </svg>
    );
  }
  if (tool === 'fill') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12.5l6.5-6.5 7 7-6 6c-.8.8-2 .8-2.8 0L5 14.3c-.5-.5-.5-1.3 0-1.8z" />
        <path d="M8.5 8.5l-2-2" />
        <path d="M17.5 17.2c.8 1.1 1.2 1.9 1.2 2.4 0 1-.7 1.6-1.6 1.6s-1.6-.6-1.6-1.6c0-.5.4-1.3 1.2-2.4.2-.3.6-.3.8 0z" />
      </svg>
    );
  }
  if (tool === 'remove') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 12.5l6.5-6.5 7 7-6 6c-.8.8-2 .8-2.8 0L5 14.3c-.5-.5-.5-1.3 0-1.8z" />
        <path d="M8.5 8.5l-2-2" />
        <path d="M15.5 17.5l4 4M19.5 17.5l-4 4" />
      </svg>
    );
  }
  if (tool === 'recolor') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 7.5h7.2c2.2 0 4 1.8 4 4v.3" />
        <path d="M9 4.5 6 7.5l3 3" />
        <path d="M18 16.5h-7.2c-2.2 0-4-1.8-4-4v-.3" />
        <path d="M15 19.5l3-3-3-3" />
        <path d="M8 16.2c.9 1.2 1.3 2 1.3 2.6 0 1-.7 1.7-1.7 1.7S6 19.8 6 18.8c0-.6.4-1.4 1.3-2.6.2-.3.5-.3.7 0z" />
      </svg>
    );
  }
  if (tool === 'eyedropper') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M14.8 4.3l4.9 4.9-3.1 3.1-1.5-1.5-7.9 7.9H4.8v-2.4l7.9-7.9-1.1-1.1 3.2-3z" />
        <path d="M5 20h6" />
      </svg>
    );
  }
  if (tool === 'move') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v18" />
        <path d="M8.5 6.5 12 3l3.5 3.5" />
        <path d="M8.5 17.5 12 21l3.5-3.5" />
        <path d="M3 12h18" />
        <path d="M6.5 8.5 3 12l3.5 3.5" />
        <path d="M17.5 8.5 21 12l-3.5 3.5" />
      </svg>
    );
  }
  if (tool === 'copy') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="8" y="8" width="11" height="11" rx="2" />
        <path d="M5 16V6.8C5 5.8 5.8 5 6.8 5H16" />
        <path d="M11 12h5M13.5 9.5v5" />
      </svg>
    );
  }
  if (tool === 'paste') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M9 5h6l1 2h2.2c.9 0 1.8.8 1.8 1.8v9.4c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8V8.8C4 7.8 4.8 7 5.8 7H8z" />
        <path d="M9 5c0-1.1.8-2 2-2h2c1.2 0 2 .9 2 2" />
        <path d="M8 12h8M8 16h5" />
      </svg>
    );
  }
  if (tool === 'mirror') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v16" />
        <path d="M5 7.5h4v9H5z" />
        <path d="M19 7.5h-4v9h4z" />
        <path d="M9 12h6" />
        <path d="M7 5.5 5 7.5l2 2" />
        <path d="M17 5.5l2 2-2 2" />
      </svg>
    );
  }
  if (tool === 'shape') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 16.5 9 8.5l4 7.5z" />
        <path d="M13.8 5.2h5v5h-5z" />
        <path d="M14.8 17.4a2.8 2.8 0 1 0 5.6 0 2.8 2.8 0 0 0-5.6 0z" />
      </svg>
    );
  }
  if (tool === 'text') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 6h14" />
        <path d="M12 6v12" />
        <path d="M8.5 18h7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.5 11.5V6.8a2 2 0 0 1 4 0v4.5" />
      <path d="M12.5 11V5.5a2 2 0 0 1 4 0V12" />
      <path d="M16.5 12V8.2a2 2 0 0 1 4 0v6.3c0 3.8-2.7 6.5-6.7 6.5h-1.5c-2.1 0-3.6-.8-4.9-2.4L4.6 15c-.6-.8-.4-1.9.4-2.4.6-.4 1.4-.3 1.9.2l1.6 1.7v-3z" />
    </svg>
  );
}

export function ShapeOptionIcon({ shape }: { shape: ShapeKind }) {
  if (shape === 'line') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 19 19 5" />
      </svg>
    );
  }
  if (shape === 'rectangle') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 7h14v10H5z" />
      </svg>
    );
  }
  if (shape === 'square') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 6.5h11v11h-11z" />
      </svg>
    );
  }
  if (shape === 'ellipse') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 12a7.5 5.2 0 1 0 15 0 7.5 5.2 0 0 0-15 0z" />
      </svg>
    );
  }
  if (shape === 'circle') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.5 12a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0z" />
      </svg>
    );
  }
  if (shape === 'triangle') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5 19 18H5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h12" />
      <path d="M13 8l4 4-4 4" />
    </svg>
  );
}

export function ArrowOptionIcon({ arrow }: { arrow: ArrowKind }) {
  if (arrow === 'double') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 12h12" />
        <path d="M10 8 6 12l4 4" />
        <path d="M14 8l4 4-4 4" />
      </svg>
    );
  }
  if (arrow === 'block') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 9h8V6l6 6-6 6v-3H5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h12" />
      <path d="M13 8l4 4-4 4" />
    </svg>
  );
}
