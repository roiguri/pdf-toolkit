import React from 'react';
import { Button } from '@/components/ui/button';
import { Highlighter } from 'lucide-react';

interface TextSelectionMenuProps {
  position: { top: number; left: number } | null;
  onHighlight: (color: string) => void;
  onClose: () => void;
}

const COLORS = [
  { name: 'Yellow', value: '#ffff00', class: 'bg-yellow-400' },
  { name: 'Green', value: '#00ff00', class: 'bg-green-400' },
  { name: 'Blue', value: '#00ffff', class: 'bg-cyan-400' }, // Cyan often looks better than deep blue for highlights
  { name: 'Pink', value: '#ff00ff', class: 'bg-pink-400' },
  { name: 'Red', value: '#ff0000', class: 'bg-red-400' },
];

const TextSelectionMenu: React.FC<TextSelectionMenuProps> = ({ position, onHighlight, onClose }) => {
  if (!position) return null;

  return (
    <div
      className="fixed z-50 bg-background border rounded-md shadow-lg p-1 animate-in fade-in zoom-in duration-200 flex flex-col gap-1"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translate(-50%, -100%) translateY(-10px)',
      }}
    >
      <div className="flex items-center gap-1 p-1">
        <span className="text-xs font-medium mr-1">Highlight:</span>
        {COLORS.map((color) => (
          <button
            key={color.name}
            className={`w-5 h-5 rounded-full border border-muted-foreground/20 hover:scale-110 transition-transform ${color.class}`}
            onClick={(e) => {
              e.stopPropagation();
              onHighlight(color.value);
            }}
            title={color.name}
          />
        ))}
      </div>
    </div>
  );
};

export default TextSelectionMenu;
