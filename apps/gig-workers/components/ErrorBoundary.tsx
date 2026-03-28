import React, { Component, ErrorInfo, ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import * as Sentry from "@sentry/react-native";

import { Button } from "heroui-native/button";
import { Card } from "heroui-native/card";

import { Icon } from "./ui/icon";
import { Screen } from "./ui/screen";

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });

        Sentry.captureException(error, {
            extra: {
                componentStack: errorInfo.componentStack,
            },
        });

        console.error("[ERROR_BOUNDARY] Caught error:", error);
        console.error("[ERROR_BOUNDARY] Component stack:", errorInfo.componentStack);
    }

    handleRetry = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null,
        });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <Screen className="justify-center px-6">
                    <Card className="rounded-[32px]">
                        <Card.Body className="items-center gap-5 px-6 py-8">
                            <View className="h-18 w-18 items-center justify-center rounded-[28px] bg-danger-soft">
                                <Icon name="warning-outline" size={30} className="text-danger" />
                            </View>
                            <View className="items-center gap-2">
                                <Text className="text-center text-2xl font-semibold text-foreground">
                                    Something went wrong
                                </Text>
                                <Text className="text-center text-sm leading-6 text-muted">
                                    We logged this issue and will look into it.
                                </Text>
                            </View>

                            {__DEV__ && this.state.error ? (
                                <ScrollView className="max-h-52 w-full rounded-[20px] bg-danger-soft px-4 py-3">
                                    <Text className="font-mono text-xs text-danger">
                                        {this.state.error.toString()}
                                    </Text>
                                    {this.state.errorInfo ? (
                                        <Text className="mt-2 font-mono text-[10px] text-danger">
                                            {this.state.errorInfo.componentStack}
                                        </Text>
                                    ) : null}
                                </ScrollView>
                            ) : null}

                            <Button onPress={this.handleRetry}>
                                <Button.Label>Try again</Button.Label>
                            </Button>
                        </Card.Body>
                    </Card>
                </Screen>
            );
        }

        return this.props.children;
    }
}

export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WithErrorBoundary(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}

export default ErrorBoundary;
