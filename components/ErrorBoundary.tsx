import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[FinancialChart Error]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex items-center justify-center w-full h-full cursor-pointer"
          style={{ background: '#1a1a2e', color: '#888', fontSize: 13 }}
          onClick={() => this.setState({ hasError: false })}
        >
          Chart error — Click to reload
        </div>
      );
    }
    return this.props.children;
  }
}
