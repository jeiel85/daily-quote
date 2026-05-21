import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QuoteCard } from './QuoteCard';
import { ErrorBoundary } from './ErrorBoundary';
import { Header } from './Header';

describe('QuoteCard', () => {
  const mockQuote = {
    text: 'Test quote text',
    author: 'Test Author',
    explanation: 'Test explanation',
    theme: 'motivation',
    createdAt: new Date(),
  };

  const mockT = (key: string) => key;

  it('renders quote when quote is provided', () => {
    render(
      <QuoteCard
        quote={mockQuote}
        isLoading={false}
        isGeneratingCard={false}
        onGenerateCard={() => {}}
        onShare={() => {}}
        t={mockT}
      />
    );

    expect(screen.getByText(/Test quote text/)).toBeDefined();
    expect(screen.getByText(/Test Author/)).toBeDefined();
  });

  it('shows no quote message when quote is null', () => {
    render(
      <QuoteCard
        quote={null}
        isLoading={false}
        isGeneratingCard={false}
        onGenerateCard={() => {}}
        onShare={() => {}}
        t={mockT}
      />
    );

    expect(screen.getByText(/home.no_quote/)).toBeDefined();
  });

  it('calls onShare when share button is clicked', () => {
    const onShare = vi.fn();
    render(
      <QuoteCard
        quote={mockQuote}
        isLoading={false}
        isGeneratingCard={false}
        onGenerateCard={() => {}}
        onShare={onShare}
        t={mockT}
      />
    );

    const shareBtn = screen.getByText(/share.button/);
    shareBtn.click();

    expect(onShare).toHaveBeenCalled();
  });
});

describe('Header', () => {
  it('renders header with logo text', () => {
    render(<Header />);
    
    expect(screen.getByText('Lumina')).toBeDefined();
    expect(screen.getByText('Daily Wisdom')).toBeDefined();
  });

  it('calls onLogout when logout button is clicked', () => {
    const onLogout = vi.fn();
    
    render(<Header onLogout={onLogout} />);
    
    const logoutBtn = document.querySelector('button');
    logoutBtn?.click();
    
    expect(onLogout).toHaveBeenCalled();
  });
});

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    const mockT = (key: string) => key;
    
    render(
      <ErrorBoundary t={mockT}>
        <div>Test Child</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Test Child')).toBeDefined();
  });

  it('shows error message when error occurs', () => {
    // Create a component that throws
    const BuggyComponent = () => {
      throw new Error('Test error');
    };
    
    const mockT = (key: string) => key;
    
    // ErrorBoundary should catch the error
    render(
      <ErrorBoundary t={mockT}>
        <BuggyComponent />
      </ErrorBoundary>
    );
    
    // Error boundary should show error message (title contains error)
    expect(screen.getByText(/common.error_boundary_title/)).toBeDefined();
  });
});