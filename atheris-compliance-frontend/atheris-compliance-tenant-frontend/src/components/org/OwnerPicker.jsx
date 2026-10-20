import PersonPicker from '../common/PersonPicker';

/**
 * Back-compat wrapper. Owner selection now goes through the shared `PersonPicker` (owner mode),
 * which is searchable and can create an owner inline. Kept so the many existing call sites
 * (controls, findings, review) keep their current prop contract.
 */
export default function OwnerPicker({
  value, onChange, label = 'Compliance Owner', size = 'small', fullWidth = true,
  allowClear = true, disabled = false, allowQuickAdd = true, helperText, sx, onOwnerCreated,
}) {
  return (
    <PersonPicker
      mode="owner"
      value={value}
      onChange={onChange}
      label={label}
      size={size}
      fullWidth={fullWidth}
      allowClear={allowClear}
      disabled={disabled}
      allowCreate={allowQuickAdd}
      helperText={helperText}
      sx={sx}
      onOwnerCreated={onOwnerCreated}
    />
  );
}
