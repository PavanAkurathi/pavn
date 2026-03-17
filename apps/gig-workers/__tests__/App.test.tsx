import React from 'react';
import renderer from 'react-test-renderer';
import { Text } from 'react-native';

describe('App', () => {
    it('renders correctly', () => {
        const tree = renderer.create(<Text>Workers App Test</Text>).toJSON();
        expect(tree).toBeTruthy();
    });
});
