const React = require('react');

const View = ({ children, ...props }) => React.createElement('View', props, children);
const Text = ({ children, ...props }) => React.createElement('Text', props, children);
const ScrollView = ({ children, ...props }) => React.createElement('ScrollView', props, children);
const Pressable = ({ children, ...props }) => React.createElement('Pressable', props, children);
const FlatList = ({ data = [], renderItem, keyExtractor, ...props }) =>
  React.createElement(
    'FlatList',
    props,
    data.map((item, index) => renderItem({ item, index, separators: {} })),
  );
const Image = ({ children, ...props }) => React.createElement('Image', props, children);

const Animated = {
  View: ({ children, ...props }) => React.createElement('Animated.View', props, children),
  Value: function AnimatedValue(val) {
    this._value = val;
  },
  timing: () => ({ start: jest.fn(), stop: jest.fn() }),
  sequence: () => ({ start: jest.fn(), stop: jest.fn() }),
  loop: () => ({ start: jest.fn(), stop: jest.fn() }),
};

module.exports = {
  View,
  Text,
  ScrollView,
  Pressable,
  FlatList,
  Image,
  Animated,
  StyleSheet: { create: (styles) => styles },
  Platform: { OS: 'android', select: (options) => options?.android },
};
