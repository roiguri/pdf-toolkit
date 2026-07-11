import React, { useState, useEffect, useRef } from 'react';
import { useAppStore, Bookmark, Annotation } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollText, Trash2, Highlighter, Edit2, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AnnotationsSidebarProps {
  onScrollToPage: (page: number) => void;
}

type ListItem =
  | { type: 'bookmark'; data: Bookmark }
  | { type: 'highlight'; data: Annotation };

const AnnotationsSidebar: React.FC<AnnotationsSidebarProps> = ({ onScrollToPage }) => {
  const {
    bookmarks,
    annotations,
    removeBookmark,
    updateBookmark,
    deleteAnnotation,
    updateAnnotation,
    selectedBookmarkId,
    selectedAnnotationId,
    setSelectedBookmarkId,
    setSelectedAnnotationId
  } = useAppStore();
  const { t } = useTranslation('pdf-viewer');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNote, setEditNote] = useState('');
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Combine and sort items
  const highlights = annotations.filter(a => a.type === 'highlight');
  const items: ListItem[] = [
    ...bookmarks.map(b => ({ type: 'bookmark' as const, data: b })),
    ...highlights.map(h => ({ type: 'highlight' as const, data: h }))
  ].sort((a, b) => {
    if (a.data.pageNumber !== b.data.pageNumber) {
      return a.data.pageNumber - b.data.pageNumber;
    }
    // Secondary sort: bookmarks first, then highlights
    if (a.type !== b.type) return a.type === 'bookmark' ? -1 : 1;
    // Tertiary: creation time if available, or just random stability
    return 0;
  });

  // Auto-scroll to selected item
  useEffect(() => {
    const selectedId = selectedBookmarkId || selectedAnnotationId;
    if (selectedId) {
      const el = itemRefs.current.get(selectedId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedBookmarkId, selectedAnnotationId]);

  if (items.length === 0) {
    return (
      <div className="absolute inset-y-0 start-0 z-30 shadow-lg lg:shadow-none lg:z-auto lg:static w-72 border-s bg-background p-4 flex flex-col items-center justify-center text-muted-foreground h-full">
        <ScrollText className="h-12 w-12 mb-2 opacity-50" />
        <p className="text-sm text-center">{t('noAnnotations')}</p>
        <p className="text-xs text-center mt-1">{t('noAnnotationsHint')}</p>
      </div>
    );
  }

  const startEditing = (item: ListItem) => {
    setEditingId(item.data.id);
    if (item.type === 'bookmark') {
      setEditTitle(item.data.title);
      setEditNote(item.data.note || '');
    } else {
      setEditTitle(item.data.content);
      setEditNote(item.data.note || '');
    }
  };

  const saveEdit = (item: ListItem) => {
    if (item.type === 'bookmark') {
      updateBookmark(item.data.id, { title: editTitle, note: editNote });
    } else {
      updateAnnotation(item.data.id, { note: editNote });
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditNote('');
  };

  const handleItemClick = (item: ListItem) => {
    if (item.type === 'bookmark') {
      setSelectedBookmarkId(item.data.id);
    } else {
      setSelectedAnnotationId(item.data.id);
    }
    onScrollToPage(item.data.pageNumber);
  };

  return (
    <div className="absolute inset-y-0 start-0 z-30 shadow-lg lg:shadow-none lg:z-auto lg:static w-72 border-s bg-background flex flex-col h-full">
      <div className="p-3 border-b font-medium flex items-center gap-2">
        <ScrollText className="h-4 w-4" />
        {t('annotations')}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {items.map((item) => {
          const isEditing = editingId === item.data.id;
          const isSelected = item.data.id === selectedBookmarkId || item.data.id === selectedAnnotationId;

          return (
            <div
              key={item.data.id}
              ref={(el) => {
                if (el) itemRefs.current.set(item.data.id, el);
                else itemRefs.current.delete(item.data.id);
              }}
              className={`border rounded-md p-2 bg-card text-card-foreground shadow-sm hover:shadow-md transition-all relative group ${
                isSelected ? 'ring-2 ring-primary border-primary' : ''
              }`}
            >
              {/* Header: Icon + Page Num */}
              <div className="flex items-center justify-between mb-1">
                <div
                  className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-muted-foreground"
                  onClick={() => handleItemClick(item)}
                >
                  {item.type === 'bookmark' ? (
                    <ScrollText className="h-3 w-3" />
                  ) : (
                    <Highlighter
                      className="h-3 w-3"
                      style={{ color: item.data.style?.color || '#eab308' }} // Default yellow-600
                    />
                  )}
                  {t('page', { number: item.data.pageNumber })}
                </div>
                {!isEditing && (
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); startEditing(item); }}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        item.type === 'bookmark' ? removeBookmark(item.data.id) : deleteAnnotation(item.data.id);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Content */}
              {isEditing ? (
                <div className="space-y-2 mt-2">
                  {item.type === 'bookmark' && (
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Bookmark Title"
                      className="h-7 text-sm"
                    />
                  )}
                  <Textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Add a note..."
                    className="text-xs min-h-[60px]"
                  />
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-6 w-6 p-0">
                      <X className="h-3 w-3" />
                    </Button>
                    <Button variant="default" size="sm" onClick={() => saveEdit(item)} className="h-6 w-6 p-0">
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div onClick={() => handleItemClick(item)} className="cursor-pointer">
                  {item.type === 'bookmark' ? (
                    <div className="font-medium text-sm truncate" title={item.data.title}>
                      {item.data.title}
                    </div>
                  ) : (
                    <div
                      className="text-sm italic text-muted-foreground line-clamp-2 border-l-2 pl-2 my-1"
                      style={{ borderLeftColor: item.data.style?.color || '#fde047' }} // Default yellow-300
                      title={item.data.content}
                    >
                      "{item.data.content}"
                    </div>
                  )}

                  {item.data.note && (
                    <div className="text-xs mt-1 bg-muted/50 p-1 rounded">
                      {item.data.note}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnnotationsSidebar;
