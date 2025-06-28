'use client';

import React from 'react';
import GenericModal from './generic-modal';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check } from 'lucide-react';

interface SelectionModalItem {
  id: string;
  name: string;
}

interface SelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: SelectionModalItem[];
  onSelect: (id: string) => void;
  selectedId?: string;
}

export default function SelectionModal({ isOpen, onClose, title, items, onSelect, selectedId }: SelectionModalProps) {
  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <GenericModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={`Select an item from the list below.`}
      size="md"
    >
      <ScrollArea className="h-[40vh] border rounded-md p-2">
        <div className="flex flex-col gap-2">
          {items.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No items to select.</p>
          ) : (
            items.map(item => (
              <Button
                key={item.id}
                variant={selectedId === item.id ? 'default' : 'outline'}
                className="w-full justify-between"
                onClick={() => handleSelect(item.id)}
              >
                <span className="truncate pr-2">{item.name}</span>
                {selectedId === item.id && <Check className="h-4 w-4" />}
              </Button>
            ))
          )}
        </div>
      </ScrollArea>
      <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </GenericModal>
  );
}
