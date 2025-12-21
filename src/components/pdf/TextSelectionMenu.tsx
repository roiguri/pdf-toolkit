import React from 'react';
import { Button } from '@/components/ui/button';
import { Highlighter } from 'lucide-react';

interface TextSelectionMenuProps {
  position: { top: number; left: number } | null;
  onHighlight: () => void;
  onClose: () => void;
}

const TextSelectionMenu: React.FC<TextSelectionMenuProps> = ({ position, onHighlight, onClose }) => {
  if (!position) return null;

  return (
    <div
      className="fixed z-50 bg-background border rounded-md shadow-lg p-1 animate-in fade-in zoom-in duration-200"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translate(-50%, -100%) translateY(-10px)',
      }}
    >
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onHighlight();
          }}
        >
          <Highlighter className="h-4 w-4 mr-1 text-yellow-500" />
          Highlight
        </Button>
      </div>
      {/* Invisible overlay to close menu when clicking outside is handled by global listeners usually,
          but here we might rely on selection clearing or explicit close */}
    </div>
  );
};

export default TextSelectionMenu;
