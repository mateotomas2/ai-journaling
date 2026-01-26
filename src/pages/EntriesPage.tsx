import { DayList } from '../components/navigation/DayList';
import { useDays } from '../hooks/useDay';
import { List } from 'lucide-react';

export function EntriesPage() {
  const { days, isLoading } = useDays();

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
          <List className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight m-0">All Entries</h2>
          <p className="text-sm text-muted-foreground m-0">Browse all your journal entries</p>
        </div>
      </div>

      {/* Content */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <DayList days={days} isLoading={isLoading} />
      </div>
    </div>
  );
}
