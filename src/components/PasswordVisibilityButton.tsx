type Props = {
  visible: boolean;
  onToggle: () => void;
  className?: string;
};

export function PasswordVisibilityButton({ visible, onToggle, className = "" }: Props) {
  return (
    <button
      type="button"
      className={`password-visibility-button ${className}`.trim()}
      onClick={onToggle}
      aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      aria-pressed={visible}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
        <path d="M2.8 12s3.2-5 9.2-5 9.2 5 9.2 5-3.2 5-9.2 5-9.2-5-9.2-5Z" />
        <circle cx="12" cy="12" r="2.4" />
        {visible ? <path d="m4 4 16 16" /> : null}
      </svg>
    </button>
  );
}
