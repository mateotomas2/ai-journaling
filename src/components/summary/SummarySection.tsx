import './SummarySection.css';

interface SummarySectionProps {
  title: string;
  content: string;
}

export function SummarySection({ title, content }: SummarySectionProps) {
  return (
    <div className="summary-section">
      <h4>{title}</h4>
      <p>{content}</p>
    </div>
  );
}
