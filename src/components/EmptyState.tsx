interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon = "fi fi-rr-folder-open", title, description, action, onAction }: EmptyStateProps) {
  return (
    <div className="ef-empty">
      <div className="ef-empty-icon">
        <i className={`${icon} text-2xl`} aria-hidden="true" />
      </div>
      <h3 className="ef-h3 mt-4">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-[var(--ef-muted)]">{description}</p>
      )}
      {action && onAction && (
        <button type="button" onClick={onAction} className="ef-btn ef-btn-primary mt-5">
          {action}
        </button>
      )}
    </div>
  );
}
