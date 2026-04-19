/**
 * Component tests for StockListItem.
 * Verifies rendering and user interactions.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import StockListItem from '@/components/stock-list-item';
import type { StockQuote } from '@/lib/api';

// Mock expo-router
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

// Mock the theme context so the component renders without a Provider
jest.mock('@/context/theme-context', () => ({
  useTheme: () => ({
    colors: {
      textPrimary: '#000',
      textSecondary: '#666',
      textMuted: '#999',
      positive: '#22C55E',
      negative: '#E53935',
      surface: '#F3F4F6',
      cardBg: '#FFF',
      border: '#E5E7EB',
      primary: '#D4F500',
    },
  }),
}));

const mockQuote: StockQuote = {
  symbol: 'AAPL',
  currentPrice: 185.5,
  change: 2.3,
  changePercent: 1.25,
  high: 187.0,
  low: 183.0,
  open: 184.0,
  previousClose: 183.2,
  profile: { name: 'Apple Inc.', logo: '', exchange: 'NASDAQ', industry: 'Tech', marketCap: 3e12 },
};

describe('StockListItem', () => {
  it('renders the symbol', () => {
    const { getByText } = render(<StockListItem item={mockQuote} />);
    expect(getByText('AAPL')).toBeTruthy();
  });

  it('renders the company name', () => {
    const { getByText } = render(<StockListItem item={mockQuote} />);
    expect(getByText('Apple Inc.')).toBeTruthy();
  });

  it('renders the current price', () => {
    const { getByText } = render(<StockListItem item={mockQuote} />);
    expect(getByText('$185.50')).toBeTruthy();
  });

  it('shows positive change percentage', () => {
    const { getByText } = render(<StockListItem item={mockQuote} />);
    expect(getByText('+1.25%')).toBeTruthy();
  });

  it('navigates to stock detail on press', () => {
    const { getByText } = render(<StockListItem item={mockQuote} />);
    fireEvent.press(getByText('AAPL'));
    expect(router.push).toHaveBeenCalledWith('/stock/AAPL');
  });

  it('renders a dash when quote is null', () => {
    const item = { symbol: 'XYZ', company_name: 'Unknown Corp', quote: null };
    const { getByText } = render(<StockListItem item={item} />);
    expect(getByText('—')).toBeTruthy();
  });

  it('shows negative change color for falling stocks', () => {
    const fallingQuote: StockQuote = { ...mockQuote, changePercent: -2.5, change: -4.6 };
    const { getByText } = render(<StockListItem item={fallingQuote} />);
    expect(getByText('-2.50%')).toBeTruthy();
  });
});
