import { createWhatsAppUrl, getResponsibleNames, responsibleContacts } from "../utils/helpers";

export function WhatsAppIcon({ className = "" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className={`h-4 w-4 shrink-0 ${className}`}
      fill="currentColor"
    >
      <path d="M16.04 3C8.88 3 3.06 8.82 3.06 15.98c0 2.29.6 4.52 1.75 6.49L3 29l6.7-1.76a12.9 12.9 0 0 0 6.34 1.62h.01c7.16 0 12.98-5.82 12.98-12.98C29.03 8.82 23.2 3 16.04 3Zm0 23.66h-.01c-1.94 0-3.84-.52-5.5-1.51l-.39-.23-3.98 1.04 1.06-3.88-.25-.4a10.7 10.7 0 0 1-1.63-5.7c0-5.9 4.8-10.7 10.7-10.7 2.86 0 5.54 1.11 7.56 3.13a10.62 10.62 0 0 1 3.14 7.56c0 5.9-4.8 10.69-10.7 10.69Zm5.86-8.01c-.32-.16-1.9-.94-2.2-1.05-.3-.11-.52-.16-.74.16-.21.32-.85 1.05-1.04 1.26-.19.21-.38.24-.7.08-.32-.16-1.36-.5-2.59-1.59-.96-.85-1.6-1.9-1.79-2.23-.19-.32-.02-.5.14-.66.15-.14.32-.38.48-.56.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.74-1.78-1.01-2.44-.27-.64-.54-.55-.74-.56h-.63c-.21 0-.56.08-.85.4-.3.32-1.12 1.1-1.12 2.68s1.15 3.1 1.31 3.31c.16.21 2.26 3.45 5.48 4.84.77.33 1.36.53 1.83.68.77.24 1.47.21 2.02.13.62-.09 1.9-.78 2.17-1.53.27-.75.27-1.39.19-1.53-.08-.13-.29-.21-.61-.37Z" />
    </svg>
  );
}

export function WhatsAppIconLink({ phone, label = "WhatsApp", compact = false }) {
  const url = createWhatsAppUrl(phone);
  if (!url) return <span className="text-slate-400">Sem WhatsApp</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={"Abrir WhatsApp de " + label}
      aria-label={"Abrir WhatsApp de " + label}
      className={`inline-flex items-center justify-center rounded-full text-[#25D366] transition hover:scale-110 hover:text-[#128C4A] ${
        compact ? "h-4 w-4" : "h-5 w-5"
      }`}
      onClick={(event) => event.stopPropagation()}
    >
      <WhatsAppIcon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
    </a>
  );
}

export function VolunteerWhatsAppName({ volunteer, compact = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${
        compact ? "text-sm" : "text-base"
      }`}
      style={{ color: "#172233" }}
    >
      <span>{volunteer.name}</span>
      <WhatsAppIconLink phone={volunteer.phone} label={volunteer.name} compact />
    </span>
  );
}

export function ResponsibleNames({ responsible }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {getResponsibleNames(responsible).map((name) => (
        <span key={name} className="flex items-center gap-1.5 font-semibold" style={{ color: "#172233" }}>
          <span>{name}</span>
          {responsibleContacts[name] && (
            <WhatsAppIconLink phone={responsibleContacts[name]} label={name} compact />
          )}
        </span>
      ))}
    </div>
  );
}
