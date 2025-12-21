import React from 'react';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { ScrollText, Trash2 } from 'lucide-react';

interface BookmarksSidebarProps {
  onScrollToPage: (page: number) => void;
}

const BookmarksSidebar: React.FC<BookmarksSidebarProps> = ({ onScrollToPage }) => {
  const { bookmarks, removeBookmark } = useAppStore();

  if (bookmarks.length === 0) {
    return (
      <div className="w-64 border-l bg-background p-4 flex flex-col items-center justify-center text-muted-foreground h-full">
        <ScrollText className="h-12 w-12 mb-2 opacity-50" />
        <p className="text-sm text-center">No bookmarks yet.</p>
        <p className="text-xs text-center mt-1">Bookmark pages to see them here.</p>
      </div>
    );
  }

  return (
    <div className="w-64 border-l bg-background flex flex-col h-full">
      <div className="p-3 border-b font-medium flex items-center gap-2">
        <ScrollText className="h-4 w-4" />
        Bookmarks
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {bookmarks.map((page) => (
          <div
            key={page}
            className="flex items-center justify-between p-2 rounded-md hover:bg-muted group"
          >
            <button
              onClick={() => onScrollToPage(page)}
              className="flex-1 text-left text-sm hover:underline"
            >
              Page {page}
            </button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removeBookmark(page)}
              title="Remove bookmark"
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BookmarksSidebar;
