// Roles that may look but not change registers — the backend answers 403 for them, so the UI
// hides create/import/edit actions instead of letting them fill a form first.
export const READ_ONLY_ROLES = ['AUDITOR', 'IT_OPS'];
export const isReadOnly = (role) => READ_ONLY_ROLES.includes(role);
