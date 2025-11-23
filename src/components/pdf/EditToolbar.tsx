import React from 'react';
import { Type, PenTool, Trash2, Download } from 'lucide-react';
import { useAppStore, AnnotationType } from '@/store/useAppStore';

interface EditToolbarProps {
  onExport: () => void;
}

const EditToolbar: React.FC<EditToolbarProps> = ({ onExport }) => {
  const { activeEditTool, setActiveEditTool, annotations, clearAnnotations } = useAppStore();

  const tools: { type: AnnotationType; icon: React.ReactNode; label: string }[] = [
    { type: 'signature', icon: <PenTool size={18} />, label: 'Signature' },
  ];

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg">
      <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
        {tools.map((tool) => (
          <button
            key={tool.type}
            onClick={() => setActiveEditTool(tool.type)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm transition-colors ${activeEditTool === tool.type
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-200'
              }`}
            title={tool.label}
          >
            {tool.icon}
            <span className="hidden sm:inline">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1">
        {annotations.length > 0 && (
          <button
            onClick={clearAnnotations}
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-white text-red-600 hover:bg-red-50 transition-colors"
            title="Clear all annotations"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">Clear All</span>
          </button>
        )}

        <button
          onClick={onExport}
          className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm bg-green-600 text-white hover:bg-green-700 transition-colors"
          title="Export PDF with annotations"
        >
          <Download size={16} />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>
    </div>
  );
};

export default EditToolbar;
