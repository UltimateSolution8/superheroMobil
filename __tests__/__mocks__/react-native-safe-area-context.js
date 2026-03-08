const React = require('react');

const SafeAreaView = ({ children, ...props }) => React.createElement('SafeAreaView', props, children);

module.exports = {
  SafeAreaView,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
};
