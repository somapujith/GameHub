import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '@/components/shell/Modal.jsx';
import HubIcon from '@/platform/game/HubIcon.jsx';
import { paths } from '@/platform/paths.js';
import { CODE_LENGTH, isCode, normalizeCode } from './codeUtil.js';

/**
 * "Have a code?" sheet: a six-character room code -> /join/:code. Bottom sheet on phones, centred card on
 * desktop (the shared Modal handles focus trap, Esc, scroll lock and focus restore).
 */
export default function CodeSheet({ open, onClose }) {
  const navigate = useNavigate();
  const uid = useId();
  const [value, setValue] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) {
      setValue('');
      setTried(false);
    }
  }, [open]);

  const ok = isCode(value);
  const showError = tried && !ok;

  const submit = (e) => {
    e.preventDefault();
    if (!ok) {
      setTried(true);
      return;
    }
    onClose?.();
    navigate(paths.join(value));
  };

  return (
    <Modal open={open} onClose={onClose} title="Join with a code" className="hub-sheet">
      <form className="hub-code" onSubmit={submit} noValidate>
        <p className="hub-code__hint" id={`${uid}-hint`}>
          Ask the host for the {CODE_LENGTH}-character room code, or paste their invite link.
        </p>
        <label htmlFor={`${uid}-in`} className="hub-sr">
          Room code
        </label>
        <input
          id={`${uid}-in`}
          data-autofocus
          className={`hub-code__input${showError ? ' is-bad' : ''}`}
          type="text"
          value={value}
          placeholder="ABC234"
          inputMode="text"
          enterKeyHint="go"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={showError || undefined}
          aria-describedby={`${uid}-hint ${uid}-err`}
          onChange={(e) => {
            setValue(normalizeCode(e.target.value));
            setTried(false);
          }}
          onPaste={(e) => {
            e.preventDefault();
            setValue(normalizeCode(e.clipboardData.getData('text')));
            setTried(false);
          }}
        />
        <p className="hub-code__err" id={`${uid}-err`} role="alert">
          {showError ? `Enter all ${CODE_LENGTH} characters of the code.` : ''}
        </p>
        <button type="submit" className="hub-btn hub-btn--primary hub-btn--lg hub-btn--block">
          Find table <HubIcon name="arrowR" size={18} />
        </button>
      </form>
    </Modal>
  );
}
