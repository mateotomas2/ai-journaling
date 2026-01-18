import { ChatInterface } from '../components/chat/ChatInterface';
import { getTodayId, formatDayId } from '../utils/date.utils';
import './TodayPage.css';

export function TodayPage() {
  const todayId = getTodayId();

  return (
    <div className="today-page">
      <div className="today-header">
        <h2>{formatDayId(todayId)}</h2>
      </div>
      <ChatInterface dayId={todayId} />
    </div>
  );
}
