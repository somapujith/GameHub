import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { canShare, shareOrCopy, useCopied } from './clipboard.js';
import { inviteMessage, joinLink, spacedCode, whatsappUrl } from './codes.js';
import '@/styles/online.css';

function WhatsAppIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12.04 2a9.9 9.9 0 0 0-8.4 15.1L2 22l5.05-1.6A9.93 9.93 0 1 0 12.04 2zm0 1.8a8.13 8.13 0 1 1-4.3 15.05l-.3-.18-3 .95.98-2.92-.2-.31A8.13 8.13 0 0 1 12.04 3.8zm-3.1 3.6c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.5s1.07 2.9 1.22 3.1c.15.2 2.1 3.35 5.15 4.56 2.55 1 3.07.8 3.62.75.55-.05 1.78-.73 2.03-1.43.25-.7.25-1.3.18-1.43-.08-.12-.28-.2-.58-.35-.3-.15-1.78-.88-2.05-.98-.28-.1-.48-.15-.68.15-.2.3-.78.98-.95 1.18-.18.2-.35.23-.65.08-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.67-2.08-.18-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.68-.5z"
      />
    </svg>
  );
}

/** Room code in big letters + copy, share link (`origin + paths.join(code)`), WhatsApp, native share and a QR code. */
export default function ShareCard({ code, gameName, onNotify }) {
  const [codeCopied, copyCode] = useCopied();
  const [linkCopied, copyLink] = useCopied();
  const [qrOpen, setQrOpen] = useState(false);
  const link = joinLink(code);
  const notify = (text, tone) => onNotify && onNotify(text, tone);

  const share = async () => {
    const res = await shareOrCopy(inviteMessage(code, gameName));
    if (res === 'copied') notify('Invite copied to clipboard', 'good');
    else if (res === 'failed') notify('Could not share. Copy the link instead.', 'bad');
  };

  return (
    <section className="ho-card ho-share" aria-label="Invite players">
      <div className="ho-share__top">
        <div className="ho-share__codeblock">
          <span className="ho-eyebrow">Room code</span>
          <div className="ho-bigcode" aria-label={`Room code ${String(code).split('').join(' ')}`}>
            {spacedCode(code)}
          </div>
          <button
            type="button"
            className="ho-btn ho-btn--ghost ho-btn--sm"
            onClick={async () => {
              if (!(await copyCode(code))) notify('Could not copy. Select the code and copy it manually.', 'bad');
            }}
          >
            {codeCopied ? 'Copied!' : 'Copy code'}
          </button>
        </div>

        <div className={`ho-qr${qrOpen ? ' is-open' : ''}`}>
          <div className="ho-qr__tile">
            <QRCodeSVG value={link} size={132} level="M" marginSize={2} bgColor="#ffffff" fgColor="#1b1340" title={`QR code for ${link}`} />
          </div>
          <span className="ho-muted ho-qr__hint">Scan to join</span>
        </div>
      </div>

      <div className="ho-linkrow">
        <input className="ho-input ho-linkrow__input" readOnly value={link} aria-label="Invite link" onFocus={(e) => e.target.select()} />
        <button
          type="button"
          className="ho-btn ho-btn--ghost"
          onClick={async () => {
            if (!(await copyLink(link))) notify('Could not copy the link.', 'bad');
          }}
        >
          {linkCopied ? 'Copied!' : 'Copy link'}
        </button>
      </div>

      <div className="ho-share__actions">
        <a className="ho-btn ho-btn--wa" href={whatsappUrl(code, gameName)} target="_blank" rel="noopener noreferrer">
          <WhatsAppIcon /> WhatsApp
        </a>
        {canShare() && (
          <button type="button" className="ho-btn ho-btn--primary" onClick={share}>
            Share
          </button>
        )}
        <button type="button" className="ho-btn ho-btn--ghost ho-qr__toggle" onClick={() => setQrOpen((v) => !v)} aria-expanded={qrOpen}>
          {qrOpen ? 'Hide QR' : 'Show QR'}
        </button>
      </div>
    </section>
  );
}
