// Small centred confirm dialog.
import Sheet from './Sheet.jsx';
import Button from './Button.jsx';

export default function ConfirmDialog({
  open, title, text, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, onConfirm, onCancel,
}) {
  return (
    <Sheet open={open} onClose={onCancel} title={title} variant="dialog" className="hg-confirm" dismissible>
      <p className="hg-confirm-text">{text}</p>
      <div className="hg-confirm-actions">
        <Button variant="ghost" onClick={onCancel} data-autofocus="">{cancelLabel}</Button>
        <Button variant={danger ? 'rose' : 'gold'} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Sheet>
  );
}
