import { ChatInterface } from '../components/chat/ChatInterface';
import { getTodayId, formatDayId } from '../utils/date.utils';
import { Calendar } from 'lucide-react';

export function TodayPage() {
  const todayId = getTodayId();

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Date Header */}
      <div className="flex items-center gap-3 pb-4 mb-4 border-b border-border">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary">
          <Calendar className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight m-0">{formatDayId(todayId)}</h2>
          <p className="text-sm text-muted-foreground m-0">What's on your mind today?</p>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <ChatInterface dayId={todayId} />
      </div>
    </div>
  );
}
