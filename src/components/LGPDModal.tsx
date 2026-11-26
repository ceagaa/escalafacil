import { useEffect, useRef } from "react";

interface LGPDModalProps {
  onClose: () => void;
}

export default function LGPDModal({ onClose }: LGPDModalProps) {
  const titleId = useRef(`lgpd-title-${Math.random().toString(36).slice(2, 8)}`).current;
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => { previousFocus.current?.focus(); };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="lgpd-modal-backdrop fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="lgpd-modal ef-modal-panel max-h-[80vh] w-full max-w-lg overflow-auto p-6 outline-none"
      >
        <div className="flex items-center justify-between">
          <h3 id={titleId} className="ef-h2">Política de Privacidade e LGPD</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--ef-hover)] text-[var(--ef-muted)] transition hover:text-[var(--ef-text)]"
          >
            ×
          </button>
        </div>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-[var(--ef-text-2)]">
          <div>
            <h4 className="font-semibold text-[var(--ef-text)]">1. Coleta de Dados</h4>
            <p className="mt-1">
              Coletamos apenas os dados necessários para o funcionamento da plataforma: nome, e-mail,
              número de WhatsApp, congregação e disponibilidade de voluntários. Esses dados são
              fornecidos voluntariamente pelo usuário.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[var(--ef-text)]">2. Uso dos Dados</h4>
            <p className="mt-1">
              Os dados são utilizados exclusivamente para organização de escalas, comunicação entre
              coordenadores e voluntários, e gestão de departamentos dentro da plataforma.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[var(--ef-text)]">3. Compartilhamento</h4>
            <p className="mt-1">
              Seus dados não são compartilhados com terceiros. Apenas coordenadores do departamento
              ao qual você está vinculado têm acesso aos seus dados de contato.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[var(--ef-text)]">4. Segurança</h4>
            <p className="mt-1">
              Utilizamos criptografia, autenticação segura e permissões de acesso por usuário
              para proteger suas informações.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[var(--ef-text)]">5. Seus Direitos (LGPD)</h4>
            <p className="mt-1">
              Conforme a Lei Geral de Proteção de Dados, você tem direito de acessar, corrigir ou
              solicitar a exclusão dos seus dados pessoais. Para isso, entre em contato com o
              coordenador do seu departamento.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[var(--ef-text)]">6. Consentimento</h4>
            <p className="mt-1">
              Ao utilizar a plataforma e marcar o checkbox de aceite, você consente com a coleta e
              uso dos seus dados conforme descrito nesta política.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="ef-btn ef-btn-primary ef-btn-block mt-6"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
