import React from "react";
import { Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

describe("App", () => {
    it("renders correctly", () => {
        let tree!: ReactTestRenderer;

        act(() => {
            tree = create(<Text>Workers App Test</Text>);
        });

        expect(tree.toJSON()).toBeTruthy();
    });
});
