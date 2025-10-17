'use client';

import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Search, ArrowUpDown, Archive, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StudentSortOrder = 'name-asc' | 'name-desc' | 'date-desc' | 'date-asc';

interface StudentFiltersProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  sortOrder: StudentSortOrder;
  setSortOrder: (value: StudentSortOrder) => void;
  showArchived: boolean;
  setShowArchived: (value: boolean) => void;
  onAddStudent: () => void;
}

const StudentFilters: React.FC<StudentFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  sortOrder,
  setSortOrder,
  showArchived,
  setShowArchived,
  onAddStudent,
}) => {

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <div className="relative flex-grow min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search by student name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 w-full"
        />
      </div>
      <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as StudentSortOrder)}>
        <SelectTrigger className="w-full sm:w-[180px]">
          <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name-asc">Name: A-Z</SelectItem>
          <SelectItem value="name-desc">Name: Z-A</SelectItem>
          <SelectItem value="date-desc">Date Joined: Newest</SelectItem>
          <SelectItem value="date-asc">Date Joined: Oldest</SelectItem>
        </SelectContent>
      </Select>
      <div className="flex items-center space-x-2 border p-2 rounded-md">
        <Switch
          id="show-archived-toggle"
          checked={showArchived}
          onCheckedChange={setShowArchived}
        />
        <Label htmlFor="show-archived-toggle" className="flex items-center gap-1.5 text-sm cursor-pointer">
          <Archive className="h-4 w-4" /> Show Archived
        </Label>
      </div>
       <Button onClick={onAddStudent} size="sm" className="h-10">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Student
      </Button>
    </div>
  );
};

export default StudentFilters;
