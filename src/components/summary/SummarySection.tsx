interface SummarySectionProps {
  title: string;
  content: string;
}

export function SummarySection({ title, content }: SummarySectionProps) {
  return (
    <div className="mb-4 last:mb-0">
      <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{title}</h4>
      <p className="text-foreground leading-relaxed">{content}</p>
    </div>
  );
}
