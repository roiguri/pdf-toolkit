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
    <div className="flex items-center gap-3 p-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg">
      <div className="flex items-center gap-1 border-r border-gray-200 pr-3">
        {tools.map((tool) => (
          <button
            key={tool.type}
            onClick={() => setActiveEditTool(activeEditTool === tool.type ? null : tool.type)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 active:scale-95 ${activeEditTool === tool.type
              ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-600 ring-offset-2'
              : 'bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-blue-600 border border-transparent hover:border-gray-200'
              }`}
            title={tool.label}
          >
            {tool.icon}
            <span className="hidden sm:inline">{tool.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {annotations.some(a => a.type === 'signature') && (
          <button
            onClick={() => clearAnnotations('signature')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white text-red-600 border border-red-100 hover:bg-red-50 hover:border-red-200 shadow-sm hover:shadow transition-all duration-200 active:scale-95"
            title="Clear all signatures"
          >
            <Trash2 size={16} />
            <span className="hidden sm:inline">Clear Signatures</span>
          </button>
        )}

        <button
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white shadow-sm hover:bg-green-700 hover:shadow-md hover:ring-2 hover:ring-green-600 hover:ring-offset-2 transition-all duration-200 active:scale-95"
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
