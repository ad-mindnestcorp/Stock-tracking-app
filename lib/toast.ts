import Toast from 'react-native-toast-message';

/**
 * Typed toast helpers. Use these everywhere instead of Alert.alert() for
 * non-destructive feedback (errors, success messages, info).
 *
 * For destructive confirmations (delete, sign-out) keep using Alert.alert()
 * since it blocks the UI until the user confirms — which is the right UX.
 */
export const toast = {
  success: (message: string, title = 'Success') =>
    Toast.show({ type: 'success', text1: title, text2: message, position: 'top' }),

  error: (message: string, title = 'Error') =>
    Toast.show({ type: 'error', text1: title, text2: message, position: 'top' }),

  info: (message: string, title = 'Info') =>
    Toast.show({ type: 'info', text1: title, text2: message, position: 'top' }),
};
