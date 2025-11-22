'use client';

import React from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { GripVertical, X } from 'lucide-react';
import { FileMetadata } from '@/services/firestore';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';

interface MergeOrderListProps {
  files: FileMetadata[];
}

const MergeOrderList: React.FC<MergeOrderListProps> = ({ files }) => {
  const { reorderMergeSelection, removeFileFromMergeSelection } = useAppStore();

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    if (result.destination.index === result.source.index) {
      return;
    }

    reorderMergeSelection(result.source.index, result.destination.index);
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="merge-list">
        {(provided) => (
          <ul
            ref={provided.innerRef}
            {...provided.droppableProps}
            className="space-y-2"
          >
            {files.map((file, index) => (
              <Draggable key={file.id} draggableId={file.id} index={index}>
                {(provided, snapshot) => (
                  <li
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    className={`flex items-center gap-2 rounded-md border bg-background p-2 ${
                      snapshot.isDragging ? 'shadow-lg ring-2 ring-primary' : ''
                    }`}
                  >
                    <div
                      {...provided.dragHandleProps}
                      className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>
                    <span className="flex-1 truncate text-sm">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFileFromMergeSelection(file.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </li>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </ul>
        )}
      </Droppable>
    </DragDropContext>
  );
};

export default MergeOrderList;
