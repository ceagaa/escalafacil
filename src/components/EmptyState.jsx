export default function EmptyState({ icon = "fi fi-rr-folder-open", title, description, action, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <i className={`${icon} text-2xl text-slate-300`} aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-700">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-slate-400">{description}</p>
      )}
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-full bg-navy-800 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-navy-900"
        >
          {action}
        </button>
      )}
    </div>
  );
}
