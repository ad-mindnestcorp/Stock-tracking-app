/**
 * Component tests for AlertItem.
 * Verifies that the correct badge, symbol, message, and unread indicator render.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AlertItem from '@/components/alert-item';
import type { AlertLog } from '@/lib/api';

jest.mock('@/context/theme-context', () => ({
  useTheme: () => ({
    colors: {
      textPrimary: '#000',
      textSecondary: '#666',
      textMuted: '#999',
      cardBg: '#FFF',
      primary: '#D4F500',
      border: '#E5E7EB',
      alert52wHigh: '#22C55E',
      alert52wLow: '#E53935',
      alertRsiOB: '#EF4444',
      alertRsiOS: '#22C55E',
    },
  }),
}));

const baseAlert: AlertLog = {
  id: 'alert-1',
  user_id: 'user-abc',
  symbol: 'TSLA',
  alert_type: '52w_high',
  message: 'TSLA hit a 52-week high of $300.00',
  price: 300,
  rsi: null,
  week52_high: 300,
  week52_low: 180,
  is_read: false,
  triggered_at: new Date().toISOString(),
};

describe('AlertItem', () => {
  it('renders the stock symbol', () => {
    const { getByText } = render(<AlertItem alert={baseAlert} />);
    expect(getByText('TSLA')).toBeTruthy();
  });

  it('renders the alert message', () => {
    const { getByText } = render(<AlertItem alert={baseAlert} />);
    expect(getByText('TSLA hit a 52-week high of $300.00')).toBeTruthy();
  });

  it('renders the 52W HIGH badge', () => {
    const { getByText } = render(<AlertItem alert={baseAlert} />);
    expect(getByText('52W HIGH')).toBeTruthy();
  });

  it('renders the price', () => {
    const { getByText } = render(<AlertItem alert={baseAlert} />);
    expect(getByText('$300.00')).toBeTruthy();
  });

  it('calls onMarkRead when unread alert is pressed', () => {
    const onMarkRead = jest.fn();
    const { getByText } = render(<AlertItem alert={baseAlert} onMarkRead={onMarkRead} />);
    fireEvent.press(getByText('TSLA'));
    expect(onMarkRead).toHaveBeenCalledWith('alert-1');
  });

  it('does not call onMarkRead when already read', () => {
    const onMarkRead = jest.fn();
    const readAlert: AlertLog = { ...baseAlert, is_read: true, user_id: 'user-abc' };
    const { getByText } = render(<AlertItem alert={readAlert} onMarkRead={onMarkRead} />);
    fireEvent.press(getByText('TSLA'));
    expect(onMarkRead).not.toHaveBeenCalled();
  });

  it('renders RSI value when present', () => {
    const alertWithRsi: AlertLog = { ...baseAlert, rsi: 72.5, user_id: 'user-abc' };
    const { getByText } = render(<AlertItem alert={alertWithRsi} />);
    expect(getByText('72.5')).toBeTruthy();
  });
});
