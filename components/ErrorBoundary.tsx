'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import ErrorFallback from './ErrorFallback';

interface Props {
    children?: ReactNode;
    fallback?: ReactNode;
    title?: string;
    message?: string;
    onReset?: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Here we could also log and report the error to a service like Sentry or LogRocket
        // logger.error(LogCategory.ERROR, `Runtime crash in ErrorBoundary`, { error, errorInfo });
    }

    private handleReset = () => {
        if (this.props.onReset) {
            this.props.onReset();
        }
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError && this.state.error) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <ErrorFallback
                    error={this.state.error}
                    resetErrorBoundary={this.handleReset}
                    title={this.props.title}
                    message={this.props.message}
                />
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
