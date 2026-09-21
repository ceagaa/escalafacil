import { useEffect, useRef } from "react";

export default function LGPDModal({ onClose }) {
  const titleId = useRef(`lgpd-title-${Math.random().toString(36).slice(2, 8)}`).current;
  const dialogRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    previousFocus.current = document.activeElement;
    dialogRef.current?.focus();
    return () => { previousFocus.current?.focus(); };
  }, []);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-lg max-h-[80vh] overflow-auto rounded-3xl bg-white p-6 shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between">
          <h3 id={titleId} className="text-lg font-bold text-[#172233]">Política de Privacidade e LGPD</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"
          >
            ×
          </button>
        </div>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600">
          <div>
            <h4 className="font-semibold text-[#172233]">1. Coleta de Dados</h4>
            <p className="mt-1">
              Coletamos apenas os dados necessários para o funcionamento da plataforma: nome, e-mail,
              número de WhatsApp, congregação e disponibilidade de voluntários. Esses dados são
              fornecidos voluntariamente pelo usuário.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[#172233]">2. Uso dos Dados</h4>
            <p className="mt-1">
              Os dados são utilizados exclusivamente para organização de escalas, comunicação entre
              coordenadores e voluntários, e gestão de departamentos dentro da plataforma.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[#172233]">3. Compartilhamento</h4>
            <p className="mt-1">
              Seus dados não são compartilhados com terceiros. Apenas coordenadores do departamento
              ao qual você está vinculado têm acesso aos seus dados de contato.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[#172233]">4. Segurança</h4>
            <p className="mt-1">
              Utilizamos criptografia e políticas de segurança de nível banco de dados (Supabase RLS)
              para proteger suas informações.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[#172233]">5. Seus Direitos (LGPD)</h4>
            <p className="mt-1">
              Conforme a Lei Geral de Proteção de Dados, você tem direito de acessar, corrigir ou
              solicitar a exclusão dos seus dados pessoais. Para isso, entre em contato com o
              coordenador do seu departamento.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-[#172233]">6. Consentimento</h4>
            <p className="mt-1">
              Ao utilizar a plataforma e marcar o checkbox de aceite, você consente com a coleta e
              uso dos seus dados conforme descrito nesta política.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-[#42d27b] px-4 py-3 text-sm font-semibold text-[#172233] transition hover:bg-[#36b868]"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}
