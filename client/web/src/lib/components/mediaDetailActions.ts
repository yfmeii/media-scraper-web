export type ActionButton = {
  label: string;
  icon?: 'refresh' | 'search' | 'upload';
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  onclick: () => void;
};
